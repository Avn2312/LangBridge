import React, { Suspense, lazy } from "react";
import { Route, Routes, Navigate } from "react-router";

import { Toaster } from "react-hot-toast";

import PageLoader from "./components/PageLoader.jsx";
import useAuthUser from "./hooks/useAuthUser.js";
import useSocket from "./hooks/useSocket.js";
import Layout from "./components/Layout.jsx";

const HomePage = lazy(() => import("./pages/HomePage.jsx"));
const SignUpPage = lazy(() => import("./pages/SignUpPage.jsx"));
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const NotificationPage = lazy(() => import("./pages/NotificationPage.jsx"));
const CallPage = lazy(() => import("./pages/CallPage.jsx"));
const ChatPage = lazy(() => import("./pages/ChatPage.jsx"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage.jsx"));
const FriendPage = lazy(() => import("./pages/FriendPage.jsx"));
const LearningPage = lazy(() => import("./pages/LearningPage.jsx"));
const MomentsPage = lazy(() => import("./pages/MomentsPage.jsx"));
const ModerationPage = lazy(() => import("./pages/ModerationPage.jsx"));
const ProfilePage = lazy(() => import("./pages/ProfilePage.jsx"));
const MessagesPage = lazy(() => import("./pages/MessagesPage.jsx"));

const App = () => {
  const { isLoading, authUser } = useAuthUser();

  // Initialize Socket.IO — connects when logged in, disconnects on logout
  useSocket(authUser);

  const isAuthenticated = Boolean(authUser);
  const isOnboarded = authUser?.isOnboarded;
  const isVerified = authUser?.verified;

  if (isLoading) return <PageLoader />;

  return (
    <div className="h-screen">
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path="/"
            element={
              isAuthenticated && isOnboarded ? (
                <Layout showSidebar={true}>
                  <HomePage />
                </Layout>
              ) : (
                <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
              )
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
              isAuthenticated && isOnboarded ? (
                <Layout showSidebar={true}>
                  <NotificationPage />
                </Layout>
              ) : (
                <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
              )
            }
          />
          <Route
            path="/friends"
            element={
              isAuthenticated && isOnboarded ? (
                <Layout showSidebar={true}>
                  <FriendPage />
                </Layout>
              ) : (
                <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
              )
            }
          />
          <Route
            path="/profile"
            element={
              isAuthenticated && isOnboarded ? (
                <Layout showSidebar={true}>
                  <ProfilePage />
                </Layout>
              ) : (
                <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
              )
            }
          />
          <Route
            path="/messages"
            element={
              isAuthenticated && isOnboarded && isVerified ? (
                <Layout showSidebar={true}>
                  <MessagesPage />
                </Layout>
              ) : (
                <Navigate
                  to={
                    !isAuthenticated
                      ? "/login"
                      : isOnboarded
                        ? "/"
                        : "/onboarding"
                  }
                />
              )
            }
          />
          <Route
            path="/learning"
            element={
              isAuthenticated && isOnboarded && isVerified ? (
                <Layout showSidebar={true}>
                  <LearningPage />
                </Layout>
              ) : (
                <Navigate
                  to={
                    !isAuthenticated
                      ? "/login"
                      : isOnboarded
                        ? "/"
                        : "/onboarding"
                  }
                />
              )
            }
          />
          <Route
            path="/moments"
            element={
              isAuthenticated && isOnboarded && isVerified ? (
                <Layout showSidebar={true}>
                  <MomentsPage />
                </Layout>
              ) : (
                <Navigate
                  to={
                    !isAuthenticated
                      ? "/login"
                      : isOnboarded
                        ? "/"
                        : "/onboarding"
                  }
                />
              )
            }
          />
          <Route
            path="/moderation"
            element={
              isAuthenticated && isOnboarded && isVerified ? (
                <Layout showSidebar={true}>
                  <ModerationPage />
                </Layout>
              ) : (
                <Navigate
                  to={
                    !isAuthenticated
                      ? "/login"
                      : isOnboarded
                        ? "/"
                        : "/onboarding"
                  }
                />
              )
            }
          />
          <Route
            path="/call/:id"
            element={
              isAuthenticated && isOnboarded && isVerified ? (
                <CallPage />
              ) : (
                <Navigate
                  to={
                    !isAuthenticated
                      ? "/login"
                      : isOnboarded
                        ? "/"
                        : "/onboarding"
                  }
                />
              )
            }
          />
          <Route
            path="/chat/:id"
            element={
              isAuthenticated && isOnboarded && isVerified ? (
                <Layout showSidebar={false} showNavbar={false}>
                  <ChatPage />
                </Layout>
              ) : (
                <Navigate
                  to={
                    !isAuthenticated
                      ? "/login"
                      : isOnboarded
                        ? "/"
                        : "/onboarding"
                  }
                />
              )
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
      <Toaster />
    </div>
  );
};

export default App;
