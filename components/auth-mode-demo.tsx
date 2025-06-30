'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Building2, Package, CheckCircle2, AlertCircle, ArrowRight, Key, Server, Code } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type AuthMode = 'oauth' | 'service' | 'native';

interface AuthModeInfo {
  title: string;
  description: string;
  icon: React.ReactNode;
  targetCustomer: string;
  benefits: string[];
  status: 'ready' | 'demo' | 'roadmap';
}

const authModes: Record<AuthMode, AuthModeInfo> = {
  oauth: {
    title: 'Model A: Customer Self-Deploy',
    description: 'Enterprise customers deploy Memory Box in their own Snowflake account with full OAuth integration',
    icon: <Shield className="w-6 h-6" />,
    targetCustomer: 'Large Enterprise (1000+ employees)',
    benefits: [
      'Zero additional security overhead',
      'Inherits existing RBAC, SSO, MFA',
      'Complete audit trail',
      'Data sovereignty'
    ],
    status: 'ready'
  },
  service: {
    title: 'Model B: Managed Service',
    description: 'Mid-market customers access Memory Box as a managed service with simplified deployment',
    icon: <Building2 className="w-6 h-6" />,
    targetCustomer: 'Mid-Market (100-1000 employees)',
    benefits: [
      'No SPCS setup required',
      'Professional security management',
      'Subscription-based pricing',
      'Rapid time-to-value'
    ],
    status: 'ready'
  },
  native: {
    title: 'Model C: Native App',
    description: 'Universal distribution via Snowflake Marketplace with one-click installation',
    icon: <Package className="w-6 h-6" />,
    targetCustomer: 'All Snowflake Customers',
    benefits: [
      'One-click install from Marketplace',
      'Automatic updates',
      'Native Snowsight integration',
      'Granular permission control'
    ],
    status: 'roadmap'
  }
};

export function AuthModeDemo() {
  const [selectedMode, setSelectedMode] = useState<AuthMode>('oauth');
  const [secretsValid, setSecretsValid] = useState<boolean | null>(null);
  const [validationMessage, setValidationMessage] = useState<string>('');
  const [showOAuthDialog, setShowOAuthDialog] = useState(false);
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [showSpecDialog, setShowSpecDialog] = useState(false);

  const validateSecrets = async () => {
    try {
      const response = await fetch('/api/auth/validate-secrets');
      const data = await response.json();
      
      setSecretsValid(data.valid);
      setValidationMessage(data.message);
    } catch (error) {
      setSecretsValid(false);
      setValidationMessage(`Error validating secrets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const modeInfo = authModes[selectedMode];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">Enterprise Authentication Demo</h2>
        <p className="text-muted-foreground">
          Memory Box supports three distribution models with enterprise-grade authentication
        </p>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.entries(authModes) as [AuthMode, AuthModeInfo][]).map(([mode, info]) => (
          <Card
            key={mode}
            className={`cursor-pointer transition-all ${
              selectedMode === mode ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedMode(mode)}
          >
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between">
                {info.icon}
                <Badge
                  variant={
                    info.status === 'ready' ? 'default' :
                    info.status === 'demo' ? 'secondary' : 'outline'
                  }
                >
                  {info.status === 'ready' ? 'Demo Ready' :
                   info.status === 'demo' ? 'Demo Mode' : 'Roadmap'}
                </Badge>
              </div>
              <CardTitle className="text-lg">{info.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{info.targetCustomer}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Selected Mode Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {modeInfo.icon}
            <CardTitle>{modeInfo.title}</CardTitle>
          </div>
          <CardDescription>{modeInfo.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Target Customer</h4>
            <p className="text-sm text-muted-foreground">{modeInfo.targetCustomer}</p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">Key Benefits</h4>
            <ul className="space-y-1">
              {modeInfo.benefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Secrets Validation */}
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">Secrets Management Status</h4>
            <div className="flex items-center gap-2">
              <Button onClick={validateSecrets} size="sm">
                Validate Secrets
              </Button>
              {secretsValid !== null && (
                <div className="flex items-center gap-2">
                  {secretsValid ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className="text-sm">{validationMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* Demo Actions */}
          {modeInfo.status === 'ready' && (
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">Demo Actions</h4>
              <div className="flex gap-2">
                {selectedMode === 'oauth' && (
                  <Button variant="outline" size="sm" onClick={() => setShowOAuthDialog(true)}>
                    Simulate OAuth Login
                  </Button>
                )}
                {selectedMode === 'service' && (
                  <Button variant="outline" size="sm" onClick={() => setShowServiceDialog(true)}>
                    Show Service Account
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setShowSpecDialog(true)}>
                  View SPCS Spec
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle>Snowflake Native Secrets Integration</CardTitle>
          <CardDescription>
            All authentication modes use Snowflake's native secrets management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`-- JWT Authentication Secret
CREATE SECRET memory_box_jwt_private_key
  TYPE = GENERIC_STRING
  SECRET_STRING = '<private_key_content>'
  COMMENT = 'JWT signing key for Snowflake API';

-- SPCS Container Specification
spec:
  containers:
  - name: memory-box
    secrets:
      - snowflakeSecret:
          objectName: memory_box_jwt_private_key
        envVarName: SNOWFLAKE_PRIVATE_KEY
        secretKeyRef: secret_string`}
          </pre>
        </CardContent>
      </Card>

      {/* OAuth Flow Dialog */}
      <Dialog open={showOAuthDialog} onOpenChange={setShowOAuthDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>OAuth Authentication Flow</DialogTitle>
            <DialogDescription>
              Enterprise SSO integration with zero additional passwords
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">1</div>
                <div>
                  <p className="font-medium">User accesses Memory Box</p>
                  <p className="text-sm text-muted-foreground">Clicks "Login with Company SSO"</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 ml-4 text-muted-foreground" />
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">2</div>
                <div>
                  <p className="font-medium">Redirect to Snowflake OAuth</p>
                  <p className="text-sm text-muted-foreground">Uses existing Snowflake session or prompts for SSO</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 ml-4 text-muted-foreground" />
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">3</div>
                <div>
                  <p className="font-medium">Company SSO Authentication</p>
                  <p className="text-sm text-muted-foreground">Okta, Azure AD, or other enterprise IdP</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 ml-4 text-muted-foreground" />
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">4</div>
                <div>
                  <p className="font-medium">Return with OAuth Token</p>
                  <p className="text-sm text-muted-foreground">Includes user context and permissions</p>
                </div>
              </div>
            </div>
            <Card className="bg-muted">
              <CardContent className="pt-6">
                <p className="text-sm font-medium mb-2">Key Benefits:</p>
                <ul className="text-sm space-y-1">
                  <li>• No additional passwords to manage</li>
                  <li>• Inherits all enterprise security policies</li>
                  <li>• Automatic MFA if configured</li>
                  <li>• Complete audit trail in Snowflake</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Service Account Dialog */}
      <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Service Account Configuration</DialogTitle>
            <DialogDescription>
              Managed service authentication for mid-market customers
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Service Account Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-medium">Username:</span>
                  <code className="bg-muted px-2 py-1 rounded">MEMORY_BOX_SERVICE</code>
                  <span className="font-medium">Password:</span>
                  <code className="bg-muted px-2 py-1 rounded">••••••••••••</code>
                  <span className="font-medium">Role:</span>
                  <code className="bg-muted px-2 py-1 rounded">MEMORY_BOX_SERVICE_ROLE</code>
                  <span className="font-medium">Warehouse:</span>
                  <code className="bg-muted px-2 py-1 rounded">MEMORY_BOX_WH</code>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  Security Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="space-y-1">
                  <p className="font-medium">Network Policy:</p>
                  <code className="block bg-muted px-2 py-1 rounded text-xs">
                    ALLOWED_IP_LIST = ('35.232.0.0/16', '35.240.0.0/16')
                  </code>
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Password Rotation:</p>
                  <p className="text-muted-foreground">Automated 90-day rotation via Snowflake Tasks</p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Permissions:</p>
                  <p className="text-muted-foreground">Limited to Memory Box database and required system functions</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* SPCS Specification Dialog */}
      <Dialog open={showSpecDialog} onOpenChange={setShowSpecDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>SPCS Container Specification</DialogTitle>
            <DialogDescription>
              Complete Snowpark Container Services deployment specification
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 mt-4">
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`apiVersion: v1
kind: ServiceSpec
metadata:
  name: memory-box-service
spec:
  containers:
  - name: memory-box-frontend
    image: /memory_box_db/public/memory_box_repo/frontend:latest
    resources:
      requests:
        cpu: 1
        memory: 2G
      limits:
        cpu: 2
        memory: 4G
    env:
      NEXT_PUBLIC_API_URL: http://memory-box-backend:3001
    
  - name: memory-box-backend
    image: /memory_box_db/public/memory_box_repo/backend:latest
    resources:
      requests:
        cpu: 2
        memory: 4G
      limits:
        cpu: 4
        memory: 8G
    secrets:
      # JWT Authentication
      - snowflakeSecret:
          objectName: memory_box_jwt_private_key
        envVarName: SNOWFLAKE_PRIVATE_KEY
        secretKeyRef: secret_string
      
      - snowflakeSecret:
          objectName: memory_box_jwt_fingerprint
        envVarName: SNOWFLAKE_PUBLIC_KEY_FP
        secretKeyRef: secret_string
      
      # OAuth Credentials (Model A)
      - snowflakeSecret:
          objectName: memory_box_oauth_client
        envVarName: OAUTH_CLIENT_ID
        secretKeyRef: username
      
      - snowflakeSecret:
          objectName: memory_box_oauth_client
        envVarName: OAUTH_CLIENT_SECRET
        secretKeyRef: password
      
      # Service Account (Model B)
      - snowflakeSecret:
          objectName: memory_box_service_account
        envVarName: SERVICE_ACCOUNT_USER
        secretKeyRef: username
      
      - snowflakeSecret:
          objectName: memory_box_service_account
        envVarName: SERVICE_ACCOUNT_PASSWORD
        secretKeyRef: password
    
    env:
      SNOWFLAKE_ACCOUNT: \${SNOWFLAKE_ACCOUNT}
      SNOWFLAKE_USERNAME: \${SNOWFLAKE_USERNAME}
      MEMORY_BOX_DATABASE: NATIVE_MEMORY_POC
      MEMORY_BOX_SCHEMA: CORE
      NODE_ENV: production
    
  endpoints:
  - name: frontend
    port: 3000
    public: true
    
  - name: backend
    port: 3001
    public: false
    
  volumes:
  - name: memory-cache
    source: local
    size: 10G
    
  computePool:
    name: MEMORY_BOX_COMPUTE_POOL
    instanceFamily: CPU_X64_S`}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
