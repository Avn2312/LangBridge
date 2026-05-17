import React, { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router";

import Layout from "../components/Layout.jsx";
import PageLoader from "../components/PageLoader.jsx";
import useAuthUser from "../hooks/useAuthUser.js";
import useSocket from "../hooks/useSocket.js";

const HomePage = lazy(() => import("../features/users/pages/HomePage.jsx"));
const SignUpPage = lazy(() => import("../features/auth/pages/SignUpPage.jsx"));
const LoginPage = lazy(() => import("../features/auth/pages/LoginPage.jsx"));
const NotificationPage = lazy(
  () => import("../features/notifications/pages/NotificationPage.jsx"),
);
const CallPage = lazy(() => import("../features/calls/pages/CallPage.jsx"));
const ChatPage = lazy(() => import("../features/chat/pages/ChatPage.jsx"));
const OnboardingPage = lazy(
  () => import("../features/auth/pages/OnboardingPage.jsx"),
);
const FriendPage = lazy(() => import("../features/users/pages/FriendPage.jsx"));
const LearningPage = lazy(
  () => import("../features/learning/pages/LearningPage.jsx"),
);
const MomentsPage = lazy(() => import("../features/users/pages/MomentsPage.jsx"));
const ModerationPage = lazy(
  () => import("../features/moderation/pages/ModerationPage.jsx"),
);
const ProfilePage = lazy(() => import("../features/users/pages/ProfilePage.jsx"));
const MessagesPage = lazy(
  () => import("../features/chat/pages/MessagesPage.jsx"),
);

const ProtectedLayout = ({
  children,
  authUser,
  isOnboarded,
  requireVerified = false,
  showSidebar = true,
  showNavbar = true,
}) => {
  const isAuthenticated = Boolean(authUser);
  const isVerified = authUser?.verified;

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (!isOnboarded) {
    return <Navigate to="/onboarding" />;
  }

  if (requireVerified && !isVerified) {
    return <Navigate to="/" />;
  }

  return (
    <Layout showSidebar={showSidebar} showNavbar={showNavbar}>
      {children}
    </Layout>
  );
};

export default function AppRouter() {
  const { isLoading, authUser } = useAuthUser();

  useSocket(authUser);

  const isAuthenticated = Boolean(authUser);
  const isOnboarded = authUser?.isOnboarded;

  if (isLoading) return <PageLoader />;

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedLayout authUser={authUser} isOnboarded={isOnboarded}>
              <HomePage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/signup"
          element={
            !isAuthenticated ? (
              <SignUpPage />
            ) : (
              <Navigate to={isOnboarded ? "/" : "/onboarding"} />
            )
          }
        />
        <Route
          path="/login"
          element={
            !isAuthenticated ? (
              <LoginPage />
            ) : (
              <Navigate to={isOnboarded ? "/" : "/onboarding"} />
            )
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedLayout
              authUser={authUser}
              isOnboarded={isOnboarded}
            >
              <NotificationPage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/friends"
          element={
            <ProtectedLayout authUser={authUser} isOnboarded={isOnboarded}>
              <FriendPage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedLayout authUser={authUser} isOnboarded={isOnboarded}>
              <ProfilePage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedLayout
              authUser={authUser}
              isOnboarded={isOnboarded}
              requireVerified
            >
              <MessagesPage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/learning"
          element={
            <ProtectedLayout
              authUser={authUser}
              isOnboarded={isOnboarded}
              requireVerified
            >
              <LearningPage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/moments"
          element={
            <ProtectedLayout
              authUser={authUser}
              isOnboarded={isOnboarded}
              requireVerified
            >
              <MomentsPage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/moderation"
          element={
            <ProtectedLayout
              authUser={authUser}
              isOnboarded={isOnboarded}
              requireVerified
            >
              <ModerationPage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/call/:id"
          element={
            <ProtectedLayout
              authUser={authUser}
              isOnboarded={isOnboarded}
              requireVerified
              showSidebar={false}
              showNavbar={false}
            >
              <CallPage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/chat/:id"
          element={
            <ProtectedLayout
              authUser={authUser}
              isOnboarded={isOnboarded}
              requireVerified
              showSidebar={false}
              showNavbar={false}
            >
              <ChatPage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/onboarding"
          element={
            isAuthenticated ? (
              !isOnboarded ? (
                <OnboardingPage />
              ) : (
                <Navigate to="/" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </Suspense>
  );
}

