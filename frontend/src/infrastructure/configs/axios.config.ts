import axios from "axios";
import { getSession, signOut } from "next-auth/react";
import { env } from "~/env";

const axiosInstance = axios.create({
  baseURL: `${env.NEXT_PUBLIC_API_URL}`,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 600000,
});

/* ADDING A REQUEST INTERCEPTOR */
axiosInstance.interceptors.request.use(
  async (config) => {
    const session: any = await getSession();
    if (session && session.user.token) {
      config.headers.Authorization = `Bearer ${session.user.token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      signOut({ redirect: false }).then(() => {
        window.location.reload();
      });
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;
