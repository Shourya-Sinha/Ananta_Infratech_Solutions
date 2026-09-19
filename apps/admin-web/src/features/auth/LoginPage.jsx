import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";
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
    <div className="flex min-h-screen items-center justify-center bg-graphite-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-lg font-semibold tracking-tight text-paper">Ananta Infratech</p>
          <p className="mt-1 text-sm text-graphite-300">Workforce & Project Management</p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 bg-surface p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-graphite-900">Mobile number</label>
            <input
              className="input"
              placeholder="9876543210"
              {...register("phone", { required: "Mobile number is required" })} />
            
            {errors.phone && <p className="mt-1 text-xs text-rust">{errors.phone.message}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-graphite-900">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              {...register("password", { required: "Password is required" })} />
            
            {errors.password && <p className="mt-1 text-xs text-rust">{errors.password.message}</p>}
          </div>

          {login.isError &&
          <p className="rounded bg-rust-50 px-3 py-2 text-sm text-rust">
              {login.error.message || "Login failed. Check your credentials."}
            </p>
          }

          <button type="submit" className="btn-accent w-full" disabled={login.isPending}>
            {login.isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>);

}