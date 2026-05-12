import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import StatCard from '../../components/StatCard';
import { theme } from '../../config/theme';
import { getTrainerStudentsOverview } from '../../services/trainerService';
import { useAuthStore } from '../../store/authStore';

function barColor(percent) {
  if (percent >= 85) return '#17a673';
  if (percent >= 60) return '#f5a623';
  return '#e05555';
}

export default function TrainerStudentsOpsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const studentsQuery = useQuery({
    queryKey: ['tr-students', profile?.uid],
    queryFn: () => getTrainerStudentsOverview(profile),
    enabled: Boolean(profile?.uid),
    staleTime: 30000,
    gcTime: 5 * 60000,
    refetchOnWindowFocus: false,
  });

  if (studentsQuery.isLoading) {
    return <LoadingBlock label="Ogrenci paneli yukleniyor..." />;
  }

  if (studentsQuery.isError || !studentsQuery.data) {
    return (
      <ScreenLayout title="Ogrenciler" subtitle="Veri alinirken hata olustu.">
        <EmptyState
          title="Ogrenci paneli acilamadi"
          description={studentsQuery.error?.message || 'Ogrenci verileri okunurken hata olustu.'}
        />
      </ScreenLayout>
    );
  }

  const data = studentsQuery.data;

  return (
    <ScreenLayout title="Ogrenciler" subtitle="Webdeki ogrenci gruplari ve devam yuzdeleri mobilde canli gorunur.">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stack}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>👨‍🎓 OGRENCI GRUPLARI</Text>
          <Text style={styles.heroTitle}>Devam yuzdesini canli takip et</Text>
          <Text style={styles.heroText}>Grup bazli ortalama ilerleme, ders sayisi ve ogrenci detaylari ayni veri modelinden hesaplanir.</Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Grup" value={data.summary.groupCount} />
          <StatCard label="Ogrenci" value={data.summary.studentCount} />
          <StatCard label="Ort. ilerleme" value={`%${data.summary.averageProgress}`} />
        </View>

        <SectionHeader title="Grup listesi" caption="Sube, ders saati ve ogrenci devam oranlari" />
        {!data.groups.length ? (
          <EmptyState title="Grup yok" description="Antrenore atanmis ogrenci grubu bulunamadi." />
        ) : (
          data.groups.map((group) => (
            <View key={group.key} style={styles.groupCard}>
              <Text style={styles.groupTitle}>🏢 {group.branchName} | ⏰ {group.scheduleName}</Text>
              <Text style={styles.groupMeta}>{group.lessonTypeLabel} | {group.students.length} ogrenci | {group.lessonsCount} ders{group.postponementCount ? ` | ${group.postponementCount} erteleme` : ''}</Text>
              <Text style={styles.groupMeta}>Grup ortalama devam: %{group.averageProgress}</Text>

              {group.students.map((student) => (
                <View key={student.id} style={styles.studentRow}>
                  <View style={styles.studentHeadRow}>
                    <Text style={styles.studentName}>👤 {student.fullName}</Text>
                    <Text style={styles.studentPercent}>%{student.progressPercent}</Text>
                  </View>
                  <Text style={styles.studentMeta}>Tamamlanan: {student.completedLessons}/{student.totalLessonTarget} ders</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${student.progressPercent}%`, backgroundColor: barColor(student.progressPercent) }]} />
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    paddingBottom: 24,
  },
  heroCard: {
    backgroundColor: '#e9f8f1',
    borderWidth: 1,
    borderColor: '#bde8d4',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 8,
  },
  heroEyebrow: {
    color: '#1b7f5c',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#1b4f3f',
    fontSize: 22,
    fontWeight: '800',
  },
  heroText: {
    color: '#4a6b5f',
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  groupCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d5e7f8',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 8,
  },
  groupTitle: {
    color: '#194f8a',
    fontWeight: '800',
    fontSize: 15,
  },
  groupMeta: {
    color: '#607386',
    fontSize: 12,
  },
  studentRow: {
    backgroundColor: '#f7fbff',
    borderWidth: 1,
    borderColor: '#e0edf8',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    gap: 6,
  },
  studentHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentName: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  studentPercent: {
    color: '#1b7f5c',
    fontWeight: '800',
  },
  studentMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#e5eef5',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
});
