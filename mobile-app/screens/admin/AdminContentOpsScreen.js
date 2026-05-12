import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import StatCard from '../../components/StatCard';
import { theme } from '../../config/theme';
import { deleteAnnouncement, deleteEvent, getAdminContentOverview, saveAnnouncement, saveEvent } from '../../services/adminService';
import { useAuthStore } from '../../store/authStore';
import { formatDate } from '../../utils/date';

function initialAnnouncement() {
  return { title: '', content: '', target: 'all', branchId: '', scheduleId: '' };
}

function initialEvent() {
  return { name: '', date: '', branchId: '', time: '', type: 'Etkinlik', description: '', location: '' };
}

export default function AdminContentOpsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const [announcementValues, setAnnouncementValues] = useState(initialAnnouncement());
  const [eventValues, setEventValues] = useState(initialEvent());

  const contentQuery = useQuery({
    queryKey: ['ad-content', profile?.uid],
    queryFn: () => getAdminContentOverview(profile.uid),
    enabled: Boolean(profile?.uid),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['ad-content', profile.uid] });
  }

  const announcementMutation = useMutation({
    mutationFn: () => saveAnnouncement({ adminId: profile.uid, values: announcementValues, currentAdminId: profile.uid }),
    onSuccess: () => {
      setAnnouncementValues(initialAnnouncement());
      invalidate();
    },
    onError: (error) => Alert.alert('Duyuru', error.message || 'Duyuru kaydedilemedi.'),
  });

  const eventMutation = useMutation({
    mutationFn: () => saveEvent({ adminId: profile.uid, values: eventValues, currentAdminName: profile.name }),
    onSuccess: () => {
      setEventValues(initialEvent());
      invalidate();
    },
    onError: (error) => Alert.alert('Etkinlik', error.message || 'Etkinlik kaydedilemedi.'),
  });

  const deleteAnnouncementMutation = useMutation({ mutationFn: deleteAnnouncement, onSuccess: invalidate });
  const deleteEventMutation = useMutation({ mutationFn: deleteEvent, onSuccess: invalidate });

  if (contentQuery.isLoading) {
    return <LoadingBlock label="Duyuru ve takvim modulu yukleniyor..." />;
  }

  if (contentQuery.isError) {
    return (
      <ScreenLayout title="Duyuru ve Takvim" subtitle="Icerik verileri alinirken hata olustu.">
        <EmptyState title="Icerik modulu acilamadi" description={contentQuery.error?.message || 'Duyuru veya etkinlik verileri okunamadi.'} />
      </ScreenLayout>
    );
  }

  const data = contentQuery.data;

  return (
    <ScreenLayout title="Duyuru ve Takvim" subtitle="Duyurulari yayinla ve etkinlik takvimini yonet.">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stack}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>ICERIK MERKEZI</Text>
          <Text style={styles.heroTitle}>Duyurular ve etkinlikler geri geldi</Text>
          <Text style={styles.heroText}>Admin panelinden cikardigimiz icerik akislarini finansi bozmadan ayri bir module tasidim. Indirim kodlari ise finans basligi altina alindi.</Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Duyuru" value={data.summary.announcementCount} tone="primary" />
          <StatCard label="Etkinlik" value={data.summary.eventCount} tone="success" />
        </View>

        <SectionHeader title="Duyuru olustur" caption="Genel, antrenor veya saat hedefli duyuru" />
        <View style={styles.cardBlue}>
          <TextInput style={styles.input} placeholder="Baslik" value={announcementValues.title} onChangeText={(text) => setAnnouncementValues((current) => ({ ...current, title: text }))} />
          <TextInput style={[styles.input, styles.textarea]} placeholder="Icerik" multiline value={announcementValues.content} onChangeText={(text) => setAnnouncementValues((current) => ({ ...current, content: text }))} />
          <View style={styles.chipRow}>
            {['all', 'trainers', 'schedule'].map((target) => (
              <ActionButton key={target} label={target} variant={announcementValues.target === target ? 'primary' : 'secondary'} onPress={() => setAnnouncementValues((current) => ({ ...current, target }))} />
            ))}
          </View>
          {announcementValues.target === 'schedule' ? (
            <>
              <View style={styles.chipRow}>
                {data.branches.map((branch) => (
                  <ActionButton key={branch.id} label={branch.name} variant={announcementValues.branchId === branch.id ? 'primary' : 'secondary'} onPress={() => setAnnouncementValues((current) => ({ ...current, branchId: branch.id, scheduleId: '' }))} />
                ))}
              </View>
              <View style={styles.chipRow}>
                {data.schedules.filter((schedule) => !announcementValues.branchId || schedule.branchId === announcementValues.branchId).map((schedule) => (
                  <ActionButton key={schedule.id} label={schedule.time} variant={announcementValues.scheduleId === schedule.id ? 'primary' : 'secondary'} onPress={() => setAnnouncementValues((current) => ({ ...current, scheduleId: schedule.id }))} />
                ))}
              </View>
            </>
          ) : null}
          <ActionButton label={announcementMutation.isPending ? 'Gonderiliyor...' : 'Duyuru Gonder'} onPress={() => announcementMutation.mutate()} fullWidth />
          {!data.announcements.length ? <EmptyState title="Duyuru yok" description="Henuz duyuru bulunmuyor." /> : data.announcements.map((announcement) => (
            <View key={announcement.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>📢 {announcement.title}</Text>
              <Text style={styles.itemText}>{announcement.content}</Text>
              <Text style={styles.itemText}>Hedef: {announcement.target || 'all'} | {formatDate(announcement.createdAt)}</Text>
              <ActionButton label="Sil" variant="secondary" onPress={() => deleteAnnouncementMutation.mutate(announcement.id)} />
            </View>
          ))}
        </View>

        <SectionHeader title="Etkinlik takvimi" caption="Yaklasan etkinlik ve yarismalar" />
        <View style={styles.cardPink}>
          <TextInput style={styles.input} placeholder="Etkinlik adi" value={eventValues.name} onChangeText={(text) => setEventValues((current) => ({ ...current, name: text }))} />
          <TextInput style={styles.input} placeholder="Tarih (YYYY-MM-DD)" value={eventValues.date} onChangeText={(text) => setEventValues((current) => ({ ...current, date: text }))} />
          <TextInput style={styles.input} placeholder="Saat" value={eventValues.time} onChangeText={(text) => setEventValues((current) => ({ ...current, time: text }))} />
          <TextInput style={styles.input} placeholder="Tur (Etkinlik/Yaris/Kamp)" value={eventValues.type} onChangeText={(text) => setEventValues((current) => ({ ...current, type: text }))} />
          <TextInput style={styles.input} placeholder="Konum" value={eventValues.location} onChangeText={(text) => setEventValues((current) => ({ ...current, location: text }))} />
          <TextInput style={[styles.input, styles.textarea]} placeholder="Aciklama" multiline value={eventValues.description} onChangeText={(text) => setEventValues((current) => ({ ...current, description: text }))} />
          <View style={styles.chipRow}>
            {data.branches.map((branch) => (
              <ActionButton key={`ev-${branch.id}`} label={branch.name} variant={eventValues.branchId === branch.id ? 'primary' : 'secondary'} onPress={() => setEventValues((current) => ({ ...current, branchId: branch.id }))} />
            ))}
          </View>
          <ActionButton label={eventMutation.isPending ? 'Kaydediliyor...' : 'Etkinlik Kaydet'} onPress={() => eventMutation.mutate()} fullWidth />
          {!data.events.length ? <EmptyState title="Etkinlik yok" description="Takvimde etkinlik bulunmuyor." /> : data.events.map((event) => (
            <View key={event.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>🗓️ {event.name}</Text>
              <Text style={styles.itemText}>{formatDate(event.date)} | {event.type || 'Etkinlik'}{event.time ? ` | ${event.time}` : ''}</Text>
              <Text style={styles.itemText}>{event.branchName || 'Tum Subeler'}{event.location ? ` | ${event.location}` : ''}</Text>
              {event.description ? <Text style={styles.itemText}>{event.description}</Text> : null}
              <ActionButton label="Sil" variant="secondary" onPress={() => deleteEventMutation.mutate(event.id)} />
            </View>
          ))}
        </View>

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
    backgroundColor: '#f4eefe',
    borderColor: '#decdfa',
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 8,
  },
  heroEyebrow: {
    color: '#6e3daa',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#5b2e90',
    fontSize: 22,
    fontWeight: '800',
  },
  heroText: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cardBlue: {
    backgroundColor: '#eef8ff',
    borderColor: '#cde7fb',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 10,
  },
  cardPink: {
    backgroundColor: '#fff1f7',
    borderColor: '#f5cfe0',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: theme.colors.text,
    backgroundColor: '#ffffff',
  },
  textarea: {
    minHeight: 88,
    textAlignVertical: 'top',
    paddingVertical: 12,
  },
  itemCard: {
    backgroundColor: '#ffffffd8',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
  },
  itemTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  itemText: {
    color: theme.colors.textMuted,
  },
});