#!/usr/bin/env node
import { name } from './package.json';
import { AlfCdkEc2Stack } from './alf-cdk-ec2-stack';
import { PipelineApp, PipelineAppProps } from 'alf-cdk-app-pipeline/pipeline-app';


const pipelineAppProps: PipelineAppProps = {
  branch: 'master',
  repositoryName: name,
  accounts: [
    {
      id: '981237193288',
      region: 'eu-central-1',
      stage: 'dev',
    },
    {
      id: '981237193288',
      region: 'us-east-1',
      stage: 'prod',
    },
  ],
  buildAccount: {
    id: '981237193288',
    region: 'eu-central-1',
    stage: 'dev',
  },
  customStack: (scope, account) => {
    // console.log('echo = ' + JSON.stringify(account));
    const tags = JSON.parse(process.env.tags || '{}');

    const alfCdkSpecifics = {
      ...(account.stage === 'dev' ? {
        hostedZoneId: process.env.hostedZoneId || 'Z0847928PFMOCU700U4U',
        domainName: process.env.domainName || 'i.dev.alfpro.net',
        certArn: process.env.certArn || 'arn:aws:acm:eu-central-1:981237193288:certificate/d40cd852-5bbf-4c1d-9a18-2d96e5307b4c',
      }
       : // prod
      {
        hostedZoneId: process.env.hostedZoneId || 'Z00371764UBVAUANTU0U',
        domainName: process.env.domainName || 'i.alfpro.net',
        certArn: process.env.certArn || 'arn:aws:acm:us-east-1:981237193288:certificate/09d5c91e-6579-4189-882b-798301fb8fba',
      })
    };

    return new AlfCdkEc2Stack(scope, `${name}-${account.stage}`, {
      env: {
        account: account.id,
        region: account.region,
      },
      gitRepo: process.env.gitRepo || 'alf-cdk-ec2',
      tags,
      customDomain: {
        hostedZoneId: alfCdkSpecifics.hostedZoneId,
        domainName: alfCdkSpecifics.domainName,
        certArn: alfCdkSpecifics.certArn,
      },
      stackName: process.env.stackName || `itest123`,
      stage: account.stage,
    })
  },
  testCommands: (account) => [
    `aws ec2 get-console-output --instance-id $InstanceId --region ${account.region} --output text`,
    'sleep 180',
    `curl -Ssf $InstancePublicDnsName && aws cloudformation delete-stack --stack-name itest123 --region ${account.region}`,
    // 'curl -Ssf $CustomInstanceUrl',
    // 'echo done! Delete all remaining Stacks!',
  ],
};

// tslint:disable-next-line: no-unused-expression
new PipelineApp(pipelineAppProps);
