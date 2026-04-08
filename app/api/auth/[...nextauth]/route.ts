import NextAuth from 'next-auth'
import AzureADProvider from 'next-auth/providers/azure-ad'

// Allowed email domains - add clinic domains here
const ALLOWED_DOMAINS = [
  'tipinc.ai',
  // Add more clinic domains as they onboard
]

const handler = NextAuth({
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID || 'common', // use specific tenant for single-org, 'common' for multi
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const email = user.email || ''
      const domain = email.split('@')[1]?.toLowerCase()
      
      // Check domain allowlist — return false to block (NextAuth will redirect to error page)
      if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
        return false
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (account && user) {
        token.email = user.email
        token.name = user.name
        token.provider = account.provider
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
