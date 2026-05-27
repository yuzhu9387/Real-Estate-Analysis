import Link from 'next/link'
import { RegisterForm } from '@/components/auth/register-form'

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-96 rounded-2xl bg-white p-8 shadow space-y-4">
        <h1 className="text-2xl font-semibold">Create Account</h1>
        <RegisterForm />
        <p className="text-center text-xs text-zinc-600">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  )
}
