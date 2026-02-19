import { Redirect } from 'expo-router';

export default function AuthIndexRedirect() {
  return <Redirect href="/(auth)/sign-in" />;
}
