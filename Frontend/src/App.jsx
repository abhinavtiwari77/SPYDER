import React from "react";
import "./App.css";
import { NextUIProvider } from "@nextui-org/react";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import MainAppLayout from "./Layouts/MainAppLayout";
import Dashboardd from "./Pages/Dashboardd";
import Login from "./Pages/Login";
import LoginSuccess from "./Pages/LoginSuccess";
import NewAccount from "./Pages/NewAccount";
import NextAI from "./Pages/NextAI";
import { UserContext } from "./Contexts/UserContext";
import NSFW from "./Pages/NSFW";
import FileScanner from "./Pages/FileScanner";
import ThreatIntel from "./Pages/ThreatIntel";
import Landing from "./Pages/Landing";
import Settings from "./Pages/Settings";

function ProtectedRoute({ children }) {
  const { user, loading } = React.useContext(UserContext);
  // console.log(user, loading);
  if (loading) return <div>Loading...</div>;
  return user ? children : <Navigate to="/login" />;
}

function RestrictedForLoggedInUsers({ children }) {
  const { user, loading } = React.useContext(UserContext);
  if (loading) return <div>Loading...</div>;
  return user ? <Navigate to="/" /> : children;
}

function App() {
  const PublicHome = () => {
    const { user, loading } = React.useContext(UserContext);
    if (loading) return <div>Loading...</div>;
    return user ? <Navigate to="/dashboard" /> : <Landing />;
  };

  const routes = [
    {
      path: "/",
      element: <PublicHome />,
    },
    {
      path: "/dashboard",
      element: (
        <ProtectedRoute>
          <MainAppLayout />
        </ProtectedRoute>
      ),
      children: [
        {
          index: true,
          element: <Dashboardd />,
        },
        {
          path: "nextai",
          element: <NextAI />,
        },
        {
          path: "nsfw",
          element: <NSFW />,
        },
        {
          path: "file-scanner",
          element: <FileScanner />,
        },
        {
          path: "threat-intel",
          element: <ThreatIntel />,
        },
        {
          path: "settings",
          element: <Settings />,
        },
        {
          path: "pricing",
          element: <>pricing</>,
        },
        {
          path: "u/:uid",
          element: <>Hello</>,
        },
      ],
    },
    {
      path: "/login",
      element: (
        <RestrictedForLoggedInUsers>
          <Login />
        </RestrictedForLoggedInUsers>
      ),
    },
    {
      path: "/newAccount",
      element: (
        <RestrictedForLoggedInUsers>
          <NewAccount />
        </RestrictedForLoggedInUsers>
      ),
    },
    {
      path: "/login/success",
      element: <LoginSuccess />,
    },
    {
      path: "*",
      element: <Navigate to="/" replace />,
    },
  ];

  const router = createBrowserRouter(routes);

  return (
    <NextUIProvider className="w-full h-full">
      <RouterProvider router={router} />
    </NextUIProvider>
  );
}

export default App;
