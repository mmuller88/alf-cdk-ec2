import { Vpc, MachineImage, AmazonLinuxStorage, AmazonLinuxVirt, AmazonLinuxEdition, AmazonLinuxGeneration, SecurityGroup, SubnetType, Peer, Port, InstanceType, InstanceProps, InstanceClass, InstanceSize, UserData, Instance } from '@aws-cdk/aws-ec2';
import { StackProps, CfnOutput, Construct} from '@aws-cdk/core';
import { ApplicationProtocol, ApplicationLoadBalancer } from '@aws-cdk/aws-elasticloadbalancingv2';
import { InstanceIdTarget } from '@aws-cdk/aws-elasticloadbalancingv2-targets';
import { CustomStack } from 'alf-cdk-app-pipeline/custom-stack';

export interface AlfCdkEc2StackProps extends StackProps {
  stage: string;
  vpc?: {
    vpcId: string;
    availabilityZones: string[];
  }
}

export class AlfCdkEc2Stack extends CustomStack {
  constructor(scope: Construct, id: string, props: AlfCdkEc2StackProps) {
    super(scope, id, props);

    const amznLinux = MachineImage.latestAmazonLinux({
      generation: AmazonLinuxGeneration.AMAZON_LINUX,
      edition: AmazonLinuxEdition.STANDARD,
      virtualization: AmazonLinuxVirt.HVM,
      storage: AmazonLinuxStorage.GENERAL_PURPOSE,
    });

    const userData = `Content-Type: multipart/mixed; boundary="//"
MIME-Version: 1.0

--//
Content-Type: text/cloud-config; charset="us-ascii"
MIME-Version: 1.0
Content-Transfer-Encoding: 7bit
Content-Disposition: attachment; filename="cloud-config.txt"

#cloud-config
cloud_final_modules:
- [scripts-user, always]

--//
Content-Type: text/x-shellscript; charset="us-ascii"
MIME-Version: 1.0
Content-Transfer-Encoding: 7bit
Content-Disposition: attachment; filename="userdata.txt"

#!/bin/bash
echo "sudo halt" | at now + 55 minutes
yum -y install git
REPO=alf-cdk-ec2
git clone https://@github.com/mmuller88/$REPO /usr/local/$REPO
cd /usr/local/$REPO
chmod +x init.sh && ./init.sh
sudo chmod +x start.sh && ./start.sh
sudo chown -R 33007 data/solr-data
sudo chown -R 999 logs

--//
  `
    let instanceVpc;
    if(props.vpc){
      instanceVpc = Vpc.fromVpcAttributes(this, 'defaultVPC', {
        availabilityZones: props.vpc.availabilityZones,
        vpcId: props.vpc.vpcId
      })
    }else{
      instanceVpc = new Vpc(this, 'VPC', {
        maxAzs: 1,
        subnetConfiguration: [
          {
            cidrMask: 24,
            name: 'ingress',
            subnetType: SubnetType.PUBLIC,
          },
          // {
          //   cidrMask: 24,
          //   name: 'application',
          //   subnetType: ec2.SubnetType.PRIVATE,
          // },
          // {
          //   cidrMask: 28,
          //   name: 'rds',
          //   subnetType: ec2.SubnetType.ISOLATED,
          // }
       ]
      });
      });
    }

    const securityGroup = new SecurityGroup(this, 'alfSecurityGroup', {
      vpc: instanceVpc
    })

    securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80));
    securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(22));

    const instanceProps: InstanceProps = {
      machineImage: amznLinux,
      instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.LARGE),
      keyName: 'ec2dev',
      instanceName: 'AlfCdkEc2Instance',
      vpc: instanceVpc,
      securityGroup,
      userData: UserData.forLinux({
        shebang: userData
      }),
    }

    // console.debug("instanceProps: ", JSON.stringify(instanceProps));
    const instance = new Instance(this, 'AlfCdkEc2Instance', instanceProps);

    const lb = new ApplicationLoadBalancer(this, 'LB', {
      vpc: instanceVpc,
      internetFacing: true,
      securityGroup
    });

    const listener = lb.addListener('Listener', {
      protocol: ApplicationProtocol.HTTP,
      port: 80
    })

    listener.addTargets('Target', {
      targets: [new InstanceIdTarget(instance.instanceId)],
      protocol: ApplicationProtocol.HTTP,
      port: 80,
    });

    const instanceId = new CfnOutput(this, 'InstanceId', {
      value: instance.instanceId
    });

    this.cfnOutputs['InstanceId'] = instanceId;

    const instancePublicDnsName = new CfnOutput(this, 'InstancePublicDnsName', {
      value: instance.instancePublicDnsName
    });

    this.cfnOutputs['InstancePublicDnsName'] = instancePublicDnsName;

    const loadBalancerDnsName = new CfnOutput(this, 'LoadBalancerDnsName', {
      value: lb.loadBalancerDnsName
    });

    this.cfnOutputs['LoadBalancerDnsName'] = loadBalancerDnsName;
  }
}