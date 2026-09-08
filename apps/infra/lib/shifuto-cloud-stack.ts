import * as path from "node:path";
import { Duration, RemovalPolicy, Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwIntegrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";

export interface ShifutoCloudStackProps extends StackProps {
  /** Extra CORS origins allowed in addition to the CloudFront domain (local dev). */
  devOrigins: string[];
}

/**
 * Single-stack, low-cost, AWS-native backend for the free (anonymous,
 * local-only) plan: static hosting for the SPA plus the anonymized
 * auto-assign Lambda (no personal data ever leaves the browser — see
 * apps/web/src/lib/anonymize.ts).
 *
 * There is intentionally no auth, no database, and no billing here: the
 * paid cloud-sync tier (Cognito + DynamoDB + Stripe) was removed to avoid
 * ever storing employee personal data server-side. That implementation is
 * preserved on the `cloud-sync-paid-plan` git branch if it's revisited later.
 *
 * Cost posture: every managed resource here uses pay-per-request / free-tier
 * billing (HTTP API + Lambda free tiers, S3+CloudFront at low traffic) —
 * there is no fixed monthly cost besides CloudFront's small per-GB/per-request
 * charge once traffic exists.
 */
export class ShifutoCloudStack extends Stack {
  constructor(scope: Construct, id: string, props: ShifutoCloudStackProps) {
    super(scope, id, props);

    // ---------------------------------------------------------------------
    // Frontend hosting: private S3 + CloudFront OAC (bucket is never public).
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

    // ---------------------------------------------------------------------
    // Lambda: auto-assign only. Anonymized in, anonymized out — the request
    // type (AutoAssignShiftsRequest) only accepts AnonymizedEmployee, so no
    // employee name can reach this function without going through
    // apps/web/src/lib/anonymize.ts first.
    // ---------------------------------------------------------------------
    const autoAssignFn = new lambdaNode.NodejsFunction(this, "AutoAssignShiftsFunction", {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(10),
      bundling: { minify: true, target: "es2022", externalModules: ["@aws-sdk/*"] },
      entry: path.join(__dirname, "../../api/src/handlers/autoAssignShifts.ts"),
      handler: "handler",
      logGroup: new logs.LogGroup(this, "AutoAssignLogGroup", { retention: logs.RetentionDays.TWO_WEEKS }),
    });

    // ---------------------------------------------------------------------
    // API Gateway (HTTP API — cheaper than REST API)
    // ---------------------------------------------------------------------
    const httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: "shifuto-cloud-api",
      corsPreflight: {
        allowOrigins: [webOrigin, ...props.devOrigins],
        allowMethods: [apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.OPTIONS],
        allowHeaders: ["content-type", "x-api-key"],
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

    // ---------------------------------------------------------------------
    // Outputs
    // ---------------------------------------------------------------------
    new CfnOutput(this, "CloudFrontDomain", { value: distribution.distributionDomainName });
    new CfnOutput(this, "WebBucketName", { value: webBucket.bucketName });
    new CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
  }
}
