import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import { theme } from '../../config/theme';
import { getParentDailyData } from '../../services/parentService';
import { useAuthStore } from '../../store/authStore';
import { formatDate } from '../../utils/date';

function renderWorkoutExercise(item) {
  const reps = item.reps ? `${item.reps}x` : '';
  const distance = item.distance ? `${item.distance}m ` : '';
  const style = item.style || '-';
  const rest = item.restSeconds ? ` (${item.restSeconds}s dinlenme)` : '';
  return `${reps}${distance}${style}${rest}`;
}

export default function ParentDailyOpsScreen({ navigation }) {
  const profile = useAuthStore((state) => state.profile);
  const dailyQuery = useQuery({
    queryKey: ['pr-daily', profile?.uid],
    queryFn: () => getParentDailyData(profile),
    enabled: Boolean(profile?.uid),
  });

  if (dailyQuery.isLoading) {
    return <LoadingBlock label="Gunluk veli modulu yukleniyor..." />;
  }

  const data = dailyQuery.data;

  return (
    <ScreenLayout title="Gunluk Akis" subtitle="Odeme, devam, etkinlik, duyuru ve antrenman akisini takip edin.">
      <SectionHeader title="Odeme durumu" caption="Taksit bazli plan ve odeme sonucu" />
      <View style={styles.stack}>
        {!data.payments.length ? (
          <EmptyState title="Odeme yok" description="Taksit plani bulunamadi." />
        ) : (
          data.payments.map((item) => (
            <View key={item.installmentNumber} style={styles.card}>
              <Text style={styles.cardTitle}>{item.installmentNumber}. taksit | ₺{Number(item.amount || 0).toFixed(2)}</Text>
              <Text style={styles.cardText}>Vade: {formatDate(item.dueDate)}</Text>
              <Text style={styles.cardText}>{item.paidAt ? `Odeme: ${formatDate(item.paidAt)}` : 'Odeme tarihi yok'}</Text>
              <Text style={[styles.cardText, item.remainingAmount <= 0.009 ? styles.success : styles.warning]}>
                {item.remainingAmount <= 0.009 ? 'Odeme tamamlandi' : `Kalan ₺${item.remainingAmount.toFixed(2)}`}
              </Text>
            </View>
          ))
        )}
      </View>

      <SectionHeader title="Devam durumu" caption="Katilim yuzdesi ve yoklama kayitlari" />
      <View style={styles.summaryCard}>
        <Text style={styles.cardText}>Toplam ders: {data.attendanceSummary.totalLessons}</Text>
        <Text style={styles.cardText}>Katilinan: {data.attendanceSummary.present}</Text>
        <Text style={styles.cardText}>Kacirilan: {data.attendanceSummary.missed}</Text>
        <Text style={styles.summaryValue}>Devam %{data.attendanceSummary.attendanceRate}</Text>
      </View>

      <SectionHeader title="Etkinlikler" caption="Takvim ve kulup akisindaki planlar" />
      <View style={styles.stack}>
        {!data.events.length ? (
          <EmptyState title="Etkinlik yok" description="Kayitli etkinlik bulunmuyor." />
        ) : (
          data.events.map((event) => (
            <View key={event.id} style={styles.card}>
              <Text style={styles.cardTitle}>{event.name}</Text>
              <Text style={styles.cardText}>{formatDate(event.date)} | {event.type || 'Etkinlik'}</Text>
              <Text style={styles.cardText}>{event.description || 'Aciklama yok'}</Text>
              {event.location ? <Text style={styles.cardText}>Konum: {event.location}</Text> : null}
            </View>
          ))
        )}
      </View>

      <SectionHeader title="Duyurular" caption="Ogrenciye ilgili iletiler" />
      <View style={styles.stack}>
        {!data.announcements.length ? (
          <EmptyState title="Duyuru yok" description="Ilgili duyuru bulunmuyor." />
        ) : (
          data.announcements.map((announcement) => (
            <View key={announcement.id} style={styles.card}>
              <Text style={styles.cardTitle}>{announcement.title}</Text>
              <Text style={styles.cardText}>{announcement.content}</Text>
            </View>
          ))
        )}
      </View>

      <SectionHeader title="Antrenmanlar" caption="Ogrenciye atanan workout kartlari" />
      <View style={styles.stack}>
        {!data.workouts.length ? (
          <EmptyState title="Antrenman yok" description="Bu ogrenciye workout atanmamis." />
        ) : (
          data.workouts.map((workout) => (
            <View key={workout.id} style={styles.card}>
              <Text style={styles.cardTitle}>{workout.workoutName}</Text>
              <Text style={styles.cardText}>{workout.branchName} | {workout.scheduleName}</Text>
              <Text style={styles.cardText}>{formatDate(workout.createdAt)}</Text>
              {Array.isArray(workout.exercises) && workout.exercises.length ? (
                workout.exercises.map((exercise, index) => (
                  <Text key={`${workout.id}-${index}`} style={styles.cardText}>• {renderWorkoutExercise(exercise)}</Text>
                ))
              ) : (
                <Text style={styles.cardText}>Egzersiz bilgisi yok.</Text>
              )}
            </View>
          ))
        )}
      </View>

      <SectionHeader title="Alisveris" caption="Market deneyimi artik ayri vitrinde ilerliyor" />
      <View style={styles.summaryCard}>
        <Text style={styles.cardTitle}>Magaza artik ayri bir ekranda</Text>
        <Text style={styles.cardText}>Gunluk akisi sade tuttuk. Urunler, favoriler ve siparis takibi alisveris ekraninda yonetiliyor.</Text>
        <ActionButton label="Magazaya Git" onPress={() => navigation.navigate('PRShoppingOps')} fullWidth />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 6,
  },
  cardTitle: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  cardText: {
    color: theme.colors.textMuted,
  },
  summaryCard: {
    backgroundColor: '#eef8ff',
    borderWidth: 1,
    borderColor: '#c9e3f8',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 6,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  textarea: {
    minHeight: 88,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cartRow: {
    borderWidth: 1,
    borderColor: '#c9e3f8',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    gap: 10,
    backgroundColor: '#ffffff',
  },
  cartMeta: {
    gap: 4,
  },
  cartActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryValue: {
    color: theme.colors.primaryDeep,
    fontWeight: '800',
    fontSize: 22,
  },
  success: {
    color: theme.colors.success,
  },
  warning: {
    color: theme.colors.warning,
  },
  price: {
    color: theme.colors.success,
    fontWeight: '800',
    fontSize: 20,
  },
});