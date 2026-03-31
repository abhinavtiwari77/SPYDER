import { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UserContext } from "../Contexts/UserContext";

const LoginSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithToken } = useContext(UserContext);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const completeGoogleLogin = async () => {
      const params = new URLSearchParams(location.search);
      const token = params.get("token");

      if (!token) {
        if (active) {
          setError("Missing login token. Please try Google sign-in again.");
        }
        return;
      }

      try {
        await loginWithToken(token);
        if (active) {
          navigate("/dashboard", { replace: true });
        }
      } catch (loginError) {
        if (active) {
          setError(loginError?.response?.data?.message || "Google login failed. Please try again.");
        }
      }
    };

    completeGoogleLogin();

    return () => {
      active = false;
    };
  }, [location.search, loginWithToken, navigate]);

  return (
    <div className="w-full min-h-full bg-app px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md mono-panel p-6 md:p-8 text-center">
        <p className="mono-label text-[11px] uppercase text-black/60 dark:text-white/60">Google authentication</p>
        <h1 className="text-2xl font-semibold mt-2 tracking-tight">Signing you in...</h1>
        <p className="text-sm text-black/65 dark:text-white/65 mt-2">
          Please wait while we complete your Google login.
        </p>

        {error && (
          <>
            <p className="mt-4 text-sm text-red-500">{error}</p>
            <button
              onClick={() => navigate("/login", { replace: true })}
              className="mt-4 w-full h-11 rounded-xl border border-black/20 dark:border-white/20 font-medium"
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginSuccess;
