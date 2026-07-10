import { LoginForm } from "@/components/auth/login-form";

// Auth pages depend on runtime env + cookies — never static-prerender them.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm />;
}
