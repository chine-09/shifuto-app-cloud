#!/usr/bin/env node
import "source-map-support/register.js";
import { App } from "aws-cdk-lib";
import { ShifutoCloudStack } from "../lib/shifuto-cloud-stack";

const app = new App();

new ShifutoCloudStack(app, "ShifutoCloudStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "ap-northeast-1",
  },
  // Must be globally unique across all AWS accounts (Cognito Hosted UI domain).
  cognitoDomainPrefix: app.node.tryGetContext("cognitoDomainPrefix") ?? "shifuto-cloud",
  // Vite picks the next free port when its default is taken, so allow a
  // small range of likely ports rather than just one — this is dev-only
  // convenience, never used for the deployed CORS origin.
  devOrigins: ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176", "http://localhost:5183", "http://localhost:5184", "http://localhost:5185"],
});
