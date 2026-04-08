#!/bin/bash
# JWT Secret Rotation Script
# Run: ./scripts/rotate-jwt-secret.sh
# Then update the secret in Vercel and Azure Key Vault

NEW_SECRET=$(openssl rand -hex 32)
echo ""
echo "=== NEW JWT SECRET ==="
echo "$NEW_SECRET"
echo ""
echo "Steps to rotate:"
echo "1. Run: vercel env rm JWT_SECRET production"
echo "2. Run: printf '$NEW_SECRET' | vercel env add JWT_SECRET production"
echo "3. Go to Azure Key Vault → hivevault-swarm → Secrets → iat-jwt-secret → New Version"
echo "4. Paste the secret above as the new value"
echo "5. Redeploy: vercel --prod"
echo ""
echo "Note: All active sessions will be invalidated after rotation."
