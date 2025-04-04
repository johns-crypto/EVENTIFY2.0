// src/App.tsx
import { Suspense, lazy, Component, ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Sidebar from './components/Sidebar';
import { AuthProvider } from './context/AuthContext';

// Lazy-loaded components
const Home = lazy(() => import('./pages/Home'));
const Events = lazy(() => import('./pages/Events'));
const Businesses = lazy(() => import('./pages/Businesses'));
const BusinessProfile = lazy(() => import('./pages/BusinessProfiles'));
const ServiceProviderProfile = lazy(() => import('./pages/ServiceProviderProfile'));
const Profile = lazy(() => import('./pages/Profile'));
const Register = lazy(() => import('./pages/Register'));
const Login = lazy(() => import('./pages/Login'));
const BusinessRegister = lazy(() => import('./pages/BusinessRegister'));
const BusinessLogin = lazy(() => import('./pages/BusinessLogin'));
const Feed = lazy(() => import('./pages/Feed'));
const EventDetail = lazy(() => import('./pages/EventDetail'));
const About = lazy(() => import('./pages/About'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Settings = lazy(() => import('./pages/Settings'));
const Chat = lazy(() => import('./pages/Chat'));
const MediaEditor = lazy(() => import('./components/MediaEditor.tsx'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Search = lazy(() => import('./pages/Search.tsx'));

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="text-neutral-lightGray text-center mt-20">
          <h2 className="text-2xl font-semibold text-red-500 mb-2">Error</h2>
          <p>Something went wrong. Please try again later.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <div className="flex flex-col min-h-screen bg-neutral-darkGray">
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="flex items-center justify-center min-h-[50vh]">
                  <svg
                    className="animate-spin h-8 w-8 text-accent-gold"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="ml-2 text-neutral-lightGray">Loading...</span>
                </div>
              }
            >
              <Sidebar>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/events" element={<Events />} />
                  <Route path="/businesses" element={<Businesses />} />
                  <Route path="/business-profiles" element={<BusinessProfile />} />
                  <Route path="/business-profiles/:id" element={<BusinessProfile />} />
                  <Route path="/service-provider/:providerId" element={<ServiceProviderProfile />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/business-register" element={<BusinessRegister />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/business-login" element={<BusinessLogin />} />
                  <Route path="/feed" element={<Feed />} />
                  <Route path="/events/:eventId" element={<EventDetail />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/chat" element={<Navigate to="/events" replace />} />
                  <Route path="/chat/:eventId" element={<Chat />} />
                  <Route path="/media-editor" element={<MediaEditor />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="*" element={<div className="text-neutral-lightGray text-center mt-20">404 - Not Found</div>} />
                </Routes>
              </Sidebar>
            </Suspense>
          </ErrorBoundary>
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="dark"
          />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;