import { Suspense } from "react";
import { LoginPage } from "~/presentation/pages";

export default function Login() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPage />
    </Suspense>
  );
}
