import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-cream dark:bg-dark-bg">
      <div className="mx-auto max-w-[420px] px-6 py-10 sm:py-14">
        <div className="mb-10 flex items-center justify-between">
          <Link href="/">
            <Logo size={24} wordmarkClassName="text-base" />
          </Link>
          <ThemeToggle />
        </div>
        <RegisterForm />
      </div>
    </div>
  );
}
