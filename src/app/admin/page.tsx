import { redirect } from 'next/navigation';

export default function LegacyAdminIndexRedirect() {
  redirect('/pl/admin');
}