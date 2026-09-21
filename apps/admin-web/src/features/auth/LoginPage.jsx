import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import { useLogin } from "./api";
import { useAuthStore } from "@/stores/authStore";

export function LoginPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm();

  if (accessToken) return <Navigate to="/" replace />;

  const onSubmit = handleSubmit((data) => {
    login.mutate(data, { onSuccess: () => navigate("/", { replace: true }) });
  });

  return (
    <div className="login-shell">
      <div className="login-glow login-glow-one" />
      <div className="login-glow login-glow-two" />
      <div className="login-layout">
        <div className="login-story">
          <div className="login-brand">
            <span className="brand-mark"><Sparkles size={20} /></span>
            <span>
              <strong>Ananta Infratech</strong>
              <small>Operations OS</small>
            </span>
          </div>
          <p className="login-kicker">Build with clarity</p>
          <h1>Every site.<br /><span>One clear view.</span></h1>
          <p className="login-copy">Coordinate workforce, attendance, finance and field operations from one calm command centre.</p>
          <div className="login-story-line"><span /><span /><span /></div>
        </div>

        <form onSubmit={onSubmit} className="login-card">
          <div className="login-card-heading">
            <span className="login-lock"><LockKeyhole size={18} /></span>
            <div>
              <p className="login-eyebrow">Secure workspace</p>
              <h2>Welcome back</h2>
            </div>
          </div>
          <p className="mb-6 text-sm leading-6 text-graphite-500">Sign in to continue managing your projects.</p>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-graphite-900">Mobile number</label>
              <input
                className="input"
                placeholder="9876543210"
                autoComplete="username"
                {...register("phone", { required: "Mobile number is required" })} />
              {errors.phone && <p className="mt-1 text-xs text-rust">{errors.phone.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-graphite-900">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                autoComplete="current-password"
                {...register("password", { required: "Password is required" })} />
              {errors.password && <p className="mt-1 text-xs text-rust">{errors.password.message}</p>}
            </div>

            {login.isError && (
              <p className="rounded-xl bg-rust-50 px-3 py-2.5 text-sm text-rust">
                {login.error.message || "Login failed. Check your credentials."}
              </p>
            )}

            <button type="submit" className="login-submit" disabled={login.isPending}>
              <span>{login.isPending ? "Signing in…" : "Enter workspace"}</span>
              {!login.isPending && <ArrowRight size={17} />}
            </button>
          </div>
          <p className="mt-6 text-center text-[11px] font-medium text-graphite-300">Protected by role-based access control</p>
        </form>
      </div>
    </div>
  );
}
