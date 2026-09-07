import * as path from "node:path";
import { Duration, RemovalPolicy, Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwAuthorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as apigwIntegrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";

export interface ShifutoCloudStackProps extends StackProps {
  /** Globally-unique prefix for the Cognito Hosted UI domain. */
  cognitoDomainPrefix: string;
  /** Extra CORS origins allowed in addition to the CloudFront domain (local dev). */
  devOrigins: string[];
}

/**
 * Single-stack, low-cost, AWS-native backend for the free (anonymous, local-only)
 * and paid (Cognito-authenticated, cloud auto-save + Stripe billing) tiers.
 *
 * Cost posture: every managed resource here uses pay-per-request / free-tier
 * billing (DynamoDB on-demand, HTTP API + Lambda + Cognito free tiers, S3+CloudFront
 * at low traffic) — there is no fixed monthly cost besides CloudFront's small
 * per-GB/per-request charge once traffic exists.
 */
export class ShifutoCloudStack extends Stack {
  constructor(scope: Construct, id: string, props: ShifutoCloudStackProps) {
    super(scope, id, props);

    // ---------------------------------------------------------------------
    // Auth: Cognito User Pool (paid-tier accounts only — free tier stays
    // anonymous and never touches this).
    // ---------------------------------------------------------------------
    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: "shifuto-cloud-users",
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: false } },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { otp: true, sms: false }, // TOTP only — SMS MFA costs per message
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const userPoolDomain = userPool.addDomain("UserPoolDomain", {
      cognitoDomain: { domainPrefix: props.cognitoDomainPrefix },
    });

    // ---------------------------------------------------------------------
    // Frontend hosting: private S3 + CloudFront OAC (bucket is never public).
    // Declared before the Lambdas below so its domain name can be used both
    // as the OAuth callback URL and as the CORS-allowed origin.
    // ---------------------------------------------------------------------
    const webBucket = new s3.Bucket(this, "WebBucket", {
      bucketName: `shifuto-cloud-web-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const distribution = new cloudfront.Distribution(this, "WebDistribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: "index.html",
      // SPA client-side routing: any path CloudFront can't find in S3 falls
      // back to index.html so react-router can resolve it in the browser.
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html", ttl: Duration.seconds(0) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html", ttl: Duration.seconds(0) },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // cheapest edge set; widen later if needed
    });

    const webOrigin = `https://${distribution.distributionDomainName}`;

    const userPoolClient = userPool.addClient("WebClient", {
      generateSecret: false, // public SPA client — PKCE, no client secret to leak
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [webOrigin, ...props.devOrigins],
        logoutUrls: [webOrigin, ...props.devOrigins],
      },
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
    });

    // ---------------------------------------------------------------------
    // Data: one on-demand table, single-table design.
    //   PK accountId = Cognito `sub` (paid tier only; free tier never writes here)
    //   SK layout: "ACCOUNT", "MASTER", "MONTH#YYYY-MM", "DAY#YYYY-MM-DD"
    // ---------------------------------------------------------------------
    const table = new dynamodb.Table(this, "Table", {
      tableName: "shifuto-cloud",
      partitionKey: { name: "accountId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED, // KMS-backed, no extra cost
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Stripe webhook events for subscription lifecycle (updated/deleted) only
    // carry the Stripe customer id, not our accountId — this index maps back
    // from the ACCOUNT item's stripeCustomerId attribute to its accountId.
    table.addGlobalSecondaryIndex({
      indexName: "byStripeCustomerId",
      partitionKey: { name: "stripeCustomerId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    // ---------------------------------------------------------------------
    // Stripe secrets — created out-of-band via:
    //   aws ssm put-parameter --name /shifuto-cloud/stripe/secret-key --type SecureString --value sk_live_...
    //   aws ssm put-parameter --name /shifuto-cloud/stripe/webhook-secret --type SecureString --value whsec_...
    //   aws ssm put-parameter --name /shifuto-cloud/stripe/price-id --type String --value price_...
    // CDK only references them by name so the real values never enter source
    // control or the CloudFormation template.
    // ---------------------------------------------------------------------
    const stripeSecretParam = ssm.StringParameter.fromSecureStringParameterAttributes(this, "StripeSecretParam", {
      parameterName: "/shifuto-cloud/stripe/secret-key",
    });
    const stripeWebhookSecretParam = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      "StripeWebhookSecretParam",
      { parameterName: "/shifuto-cloud/stripe/webhook-secret" },
    );
    // Plain (non-secret) parameter name — the Lambda fetches its value at
    // runtime via the SDK, so there is no need for CDK to resolve it (and
    // no need for a synth-time CloudFormation Parameter for it).
    const stripePriceIdParamName = "/shifuto-cloud/stripe/price-id";

    const logGroupProps = { retention: logs.RetentionDays.TWO_WEEKS };
    const commonLambdaProps: Partial<lambdaNode.NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(10),
      bundling: { minify: true, target: "es2022", externalModules: ["@aws-sdk/*"] },
    };

    // ---------------------------------------------------------------------
    // Lambdas
    // ---------------------------------------------------------------------
    const autoAssignFn = new lambdaNode.NodejsFunction(this, "AutoAssignShiftsFunction", {
      ...commonLambdaProps,
      entry: path.join(__dirname, "../../api/src/handlers/autoAssignShifts.ts"),
      handler: "handler",
      logGroup: new logs.LogGroup(this, "AutoAssignLogGroup", logGroupProps),
    });

    const getAccountFn = new lambdaNode.NodejsFunction(this, "GetAccountFunction", {
      ...commonLambdaProps,
      entry: path.join(__dirname, "../../api/src/handlers/state.ts"),
      handler: "getAccount",
      environment: { TABLE_NAME: table.tableName },
      logGroup: new logs.LogGroup(this, "GetAccountLogGroup", logGroupProps),
    });
    table.grantReadData(getAccountFn);

    const getStateFn = new lambdaNode.NodejsFunction(this, "GetStateFunction", {
      ...commonLambdaProps,
      entry: path.join(__dirname, "../../api/src/handlers/state.ts"),
      handler: "getState",
      environment: { TABLE_NAME: table.tableName },
      logGroup: new logs.LogGroup(this, "GetStateLogGroup", logGroupProps),
    });
    table.grantReadData(getStateFn);

    const putStateFn = new lambdaNode.NodejsFunction(this, "PutStateFunction", {
      ...commonLambdaProps,
      entry: path.join(__dirname, "../../api/src/handlers/state.ts"),
      handler: "putState",
      environment: { TABLE_NAME: table.tableName },
      logGroup: new logs.LogGroup(this, "PutStateLogGroup", logGroupProps),
    });
    // Write access alone isn't enough: on a conflicting write (see
    // putState's ConditionExpression), the handler reads back the current
    // items to report them in the 409 response — and grantReadWriteData
    // doesn't cover TransactWriteItems (the multi-record atomic write), so
    // that's granted explicitly.
    table.grantReadWriteData(putStateFn);
    putStateFn.addToRolePolicy(
      new iam.PolicyStatement({ actions: ["dynamodb:TransactWriteItems"], resources: [table.tableArn] }),
    );

    const createCheckoutSessionFn = new lambdaNode.NodejsFunction(this, "CreateCheckoutSessionFunction", {
      ...commonLambdaProps,
      entry: path.join(__dirname, "../../api/src/handlers/billing/createCheckoutSession.ts"),
      handler: "handler",
      environment: {
        WEB_ORIGIN: webOrigin,
        STRIPE_SECRET_PARAM: stripeSecretParam.parameterName,
        STRIPE_PRICE_ID_PARAM: stripePriceIdParamName,
      },
      logGroup: new logs.LogGroup(this, "CreateCheckoutSessionLogGroup", logGroupProps),
    });
    stripeSecretParam.grantRead(createCheckoutSessionFn);
    createCheckoutSessionFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [`arn:${this.partition}:ssm:${this.region}:${this.account}:parameter${stripePriceIdParamName}`],
      }),
    );

    const stripeWebhookFn = new lambdaNode.NodejsFunction(this, "StripeWebhookFunction", {
      ...commonLambdaProps,
      entry: path.join(__dirname, "../../api/src/handlers/billing/stripeWebhook.ts"),
      handler: "handler",
      environment: {
        TABLE_NAME: table.tableName,
        STRIPE_SECRET_PARAM: stripeSecretParam.parameterName,
        STRIPE_WEBHOOK_SECRET_PARAM: stripeWebhookSecretParam.parameterName,
      },
      logGroup: new logs.LogGroup(this, "StripeWebhookLogGroup", logGroupProps),
    });
    stripeSecretParam.grantRead(stripeWebhookFn);
    stripeWebhookSecretParam.grantRead(stripeWebhookFn);
    table.grantReadWriteData(stripeWebhookFn);

    // ---------------------------------------------------------------------
    // API Gateway (HTTP API — cheaper than REST API, native JWT authorizer)
    // ---------------------------------------------------------------------
    const jwtAuthorizer = new apigwAuthorizers.HttpJwtAuthorizer(
      "CognitoAuthorizer",
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      { jwtAudience: [userPoolClient.userPoolClientId] },
    );

    const httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: "shifuto-cloud-api",
      corsPreflight: {
        allowOrigins: [webOrigin, ...props.devOrigins],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.PUT, apigwv2.CorsHttpMethod.OPTIONS],
        allowHeaders: ["content-type", "authorization"],
      },
      createDefaultStage: false,
    });

    // Global throttle, not per-user — HTTP API has no API-key/usage-plan
    // concept like REST API. This is an abuse-cost backstop, not per-tenant
    // fairness; revisit with WAF if it's ever a problem.
    new apigwv2.HttpStage(this, "DefaultStage", {
      httpApi,
      stageName: "$default",
      autoDeploy: true,
      throttle: { rateLimit: 20, burstLimit: 40 },
    });

    httpApi.addRoutes({
      path: "/auto-assign",
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwIntegrations.HttpLambdaIntegration("AutoAssignIntegration", autoAssignFn),
    });

    httpApi.addRoutes({
      path: "/account",
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwIntegrations.HttpLambdaIntegration("GetAccountIntegration", getAccountFn),
      authorizer: jwtAuthorizer,
    });

    httpApi.addRoutes({
      path: "/state",
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwIntegrations.HttpLambdaIntegration("GetStateIntegration", getStateFn),
      authorizer: jwtAuthorizer,
    });

    httpApi.addRoutes({
      path: "/state",
      methods: [apigwv2.HttpMethod.PUT],
      integration: new apigwIntegrations.HttpLambdaIntegration("PutStateIntegration", putStateFn),
      authorizer: jwtAuthorizer,
    });

    httpApi.addRoutes({
      path: "/billing/create-checkout-session",
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwIntegrations.HttpLambdaIntegration("CreateCheckoutSessionIntegration", createCheckoutSessionFn),
      authorizer: jwtAuthorizer,
    });

    httpApi.addRoutes({
      path: "/billing/webhook",
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwIntegrations.HttpLambdaIntegration("StripeWebhookIntegration", stripeWebhookFn),
      // No authorizer: Stripe calls this directly. Authenticity is verified
      // inside the handler via the Stripe signature header instead.
    });

    // ---------------------------------------------------------------------
    // Outputs
    // ---------------------------------------------------------------------
    new CfnOutput(this, "CloudFrontDomain", { value: distribution.distributionDomainName });
    new CfnOutput(this, "WebBucketName", { value: webBucket.bucketName });
    new CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: userPoolClient.userPoolClientId });
    new CfnOutput(this, "CognitoDomain", { value: userPoolDomain.baseUrl() });
    new CfnOutput(this, "TableName", { value: table.tableName });
  }
}
