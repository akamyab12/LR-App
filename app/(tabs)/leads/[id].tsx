import { useLocalSearchParams } from 'expo-router';

import LeadDetailScreen from '@/screens/LeadDetailScreen';

function normalizeLeadId(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(trimmed) ? trimmed : null;
}

export default function LeadDetailRoute() {
  const params = useLocalSearchParams<{ id?: string | string[]; from?: string | string[] }>();
  const leadId = normalizeLeadId(params.id);
  const sourceParam = Array.isArray(params.from) ? params.from[0] : params.from;
  const routeSource = sourceParam === 'leads' ? 'leads' : 'capture';

  return <LeadDetailScreen routeLeadId={leadId} routeSource={routeSource} />;
}
