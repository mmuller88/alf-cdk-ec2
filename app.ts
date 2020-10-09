#!/usr/bin/env node
import { name } from './package.json';
import { AlfCdkEc2Stack } from './alf-cdk-ec2-stack';
import { PipelineApp, PipelineAppProps } from 'alf-cdk-app-pipeline/pipeline-app';


const pipelineAppProps: PipelineAppProps = {
  branch: 'master',
  repositoryName: name,
  customStack: (scope, account) => {
    // console.log('echo = ' + JSON.stringify(account));
    const tags = JSON.parse(process.env.tags || '{}');
    return new AlfCdkEc2Stack(scope, `${name}-${account.stage}`, {
      env: {
        region: account.region,
      },
      gitRepo: process.env.gitRepo,
      tags,
      stackName: process.env.stackName || `${name}-${account.stage}`,
      stage: account.stage,
    })
  },
  destroyStack: true,
  testCommands: (_) => [
    // Use 'curl' to GET the given URL and fail if it returns an error
    'sleep 180',
    'curl -Ssf $InstancePublicDnsName',
    'echo done!!!',
  ],
};

// tslint:disable-next-line: no-unused-expression
new PipelineApp(pipelineAppProps);
