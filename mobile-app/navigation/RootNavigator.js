import AuthNavigator from './AuthNavigator';
import RoleNavigator from './RoleNavigator';
import LoadingScreen from '../screens/shared/LoadingScreen';
import { useAuthStore } from '../store/authStore';

export default function RootNavigator() {
  const status = useAuthStore((state) => state.status);
  const bootstrapped = useAuthStore((state) => state.bootstrapped);

  if (!bootstrapped || status === 'loading') {
    return <LoadingScreen label="Oturum kontrol ediliyor..." />;
  }

  if (status !== 'authenticated') {
    return <AuthNavigator />;
  }

  return <RoleNavigator />;
}