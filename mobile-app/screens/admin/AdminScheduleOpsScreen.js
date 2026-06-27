import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import { theme } from '../../config/theme';
import { formatDate } from '../../utils/date';
import { getAdminScheduleOverview, saveAvailabilityTemplate, savePrice, saveSchedule } from '../../services/adminService';
import { useAuthStore } from '../../store/authStore';

const ALL_HOURS = Array.from({ length: 24 }, (_, hour) => {
  const start = `${String(hour).padStart(2, '0')}:00`;
  const end = `${String((hour + 1) % 24).padStart(2, '0')}:00`;
  return `${start}-${end}`;
});

const dayOptions = [
  { key: 'monday', label: 'Pazartesi' },
  { key: 'tuesday', label: 'Sali' },
  { key: 'wednesday', label: 'Carsamba' },
  { key: 'thursday', label: 'Persembe' },
  { key: 'friday', label: 'Cuma' },
  { key: 'saturday', label: 'Cumartesi' },
  { key: 'sunday', label: 'Pazar' },
];

const dayIndexMap = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function initialScheduleForm() {
  return {
    id: null,
    branchId: '',
    customName: '',
    time: '',
    lessonType: 'group',
    startDate: '',
    days: ['monday'],
    trainerIds: [],
    primaryTrainerId: '',
    assistantHeadMap: {},
    capacity: '1',
    lessonsCount: '1',
  };
}

function buildAssistantHeadMapFromSchedule(schedule) {
  const assignments = schedule.paymentSummary?.assignments || schedule.trainerAssignments || [];
  return assignments.reduce((result, assignment) => {
    if (assignment.role !== 'assistant') return result;
    const assistantKey = assignment.trainerId || assignment.trainerDocId;
    const headKey = assignment.headTrainerId || assignment.headTrainerDocId;
    if (assistantKey && headKey) {
      result[assistantKey] = headKey;
    }
    return result;
  }, {});
}

function formatLocalDateInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getNextScheduleStartDate(dayKey) {
  const targetDayIndex = dayIndexMap[dayKey];
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  if (typeof targetDayIndex !== 'number') {
    return formatLocalDateInputValue(currentDate);
  }

  const dayDiff = (targetDayIndex - currentDate.getDay() + 7) % 7;
  currentDate.setDate(currentDate.getDate() + dayDiff);
  return formatLocalDateInputValue(currentDate);
}

function toMinutes(time) {
  const match = String(time || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return Number.POSITIVE_INFINITY;
  return Number(match[1]) * 60 + Number(match[2]);
}

function normalizeClockValue(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  let match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    return '';
  }

  match = text.match(/^(\d{1,2})(\d{2})$/);
  if (match) {
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  return '';
}

function normalizeSlotLabel(slot) {
  const raw = String(slot || '').trim();
  if (!raw) return '';

  if (raw.includes('-')) {
    const [startRaw, endRaw] = raw.split('-').map((item) => item.trim());
    const start = normalizeClockValue(startRaw);
    const end = normalizeClockValue(endRaw);
    return start && end ? `${start}-${end}` : raw;
  }

  const start = normalizeClockValue(raw);
  if (!start) return raw;
  const [hourText] = start.split(':');
  const endHour = (Number(hourText) + 1) % 24;
  return `${start}-${String(endHour).padStart(2, '0')}:00`;
}

function getSlotStartValue(slot) {
  const normalizedSlot = normalizeSlotLabel(slot);
  if (!normalizedSlot) return '';
  return normalizedSlot.split('-')[0] || normalizedSlot;
}

function sortSlots(slots) {
  return [...slots].sort((left, right) => {
    const leftStart = normalizeSlotLabel(left).split('-')[0] || '';
    const rightStart = normalizeSlotLabel(right).split('-')[0] || '';
    return toMinutes(leftStart) - toMinutes(rightStart);
  });
}

export default function AdminScheduleOpsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const scheduleQuery = useQuery({
    queryKey: ['ad-schedule', profile?.uid],
    queryFn: () => getAdminScheduleOverview(profile.uid),
    enabled: Boolean(profile?.uid),
  });

  const [scheduleForm, setScheduleForm] = useState(initialScheduleForm());
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedDayKey, setSelectedDayKey] = useState('monday');
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [customSlotStart, setCustomSlotStart] = useState('');
  const [customSlotEnd, setCustomSlotEnd] = useState('');
  const [priceValues, setPriceValues] = useState({});

  function toggleSlot(slot) {
    setSelectedSlots((current) =>
      current.includes(slot) ? current.filter((item) => item !== slot) : sortSlots([...current, slot])
    );
  }

  function addCustomSlot() {
    const start = normalizeClockValue(customSlotStart);
    const end = normalizeClockValue(customSlotEnd);
    if (!start || !end) {
      Alert.alert('Saat araligi', 'Baslangic ve bitis saatini HH:MM formatinda girin.');
      return;
    }
    if (toMinutes(start) >= toMinutes(end)) {
      Alert.alert('Saat araligi', 'Bitis saati baslangictan sonra olmali.');
      return;
    }
    const slot = `${start}-${end}`;
    setSelectedSlots((current) => (current.includes(slot) ? current : sortSlots([...current, slot])));
    setCustomSlotStart('');
    setCustomSlotEnd('');
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['ad-schedule', profile.uid] });
    queryClient.invalidateQueries({ queryKey: ['ad-dashboard', profile.uid] });
  }

  const scheduleMutation = useMutation({
    mutationFn: (overrides = {}) => {
      const { quickCreate, ...overrideValues } = overrides || {};
      return saveSchedule({
        adminId: profile.uid,
        scheduleId: overrideValues.id ?? scheduleForm.id,
        values: { ...scheduleForm, ...overrideValues, trainers: scheduleQuery.data.trainers },
        currentAdminId: profile.uid,
      });
    },
    onSuccess: (_, variables) => {
      setScheduleForm(initialScheduleForm());
      invalidate();
      if (variables?.quickCreate) {
        Alert.alert('Ders saati', 'Secilen musaitlik slotu icin hizli ders kaydi olusturuldu.');
      }
    },
    onError: (error) => Alert.alert('Ders saati', error.message || 'Kaydedilemedi.'),
  });

  const availabilityMutation = useMutation({
    mutationFn: () =>
      saveAvailabilityTemplate({
        adminId: profile.uid,
        branchId: selectedBranchId,
        dayKey: selectedDayKey,
        slots: selectedSlots,
        currentAdminId: profile.uid,
      }),
    onSuccess: invalidate,
    onError: (error) => Alert.alert('Musaitlik sablonu', error.message || 'Kaydedilemedi.'),
  });

  const priceMutation = useMutation({
    mutationFn: ({ branchId, time, price }) => savePrice({ adminId: profile.uid, branchId, time, price, currentAdminId: profile.uid }),
    onSuccess: invalidate,
    onError: (error) => Alert.alert('Fiyat', error.message || 'Kaydedilemedi.'),
  });

  const selectedTemplate = useMemo(() => {
    if (!scheduleQuery.data || !selectedBranchId) return null;
    return scheduleQuery.data.availabilityTemplates.find((item) => item.branchId === selectedBranchId) || null;
  }, [scheduleQuery.data, selectedBranchId]);

  const trainerNameMap = useMemo(() => {
    const map = new Map();
    (scheduleQuery.data?.trainers || []).forEach((trainer) => {
      const displayName = String(trainer.name || '').trim();
      if (!displayName) return;
      if (trainer.id) map.set(trainer.id, displayName);
      if (trainer.uid) map.set(trainer.uid, displayName);
    });
    return map;
  }, [scheduleQuery.data]);

  function quickCreateFromPreference(preference, dayKey, slot) {
    const trainerKey = preference?.trainerId || preference?.trainerDocId || '';
    const branchId = preference?.branchId || '';
    const normalizedSlot = normalizeSlotLabel(slot);
    const time = getSlotStartValue(normalizedSlot);

    if (!trainerKey || !branchId || !time) {
      Alert.alert('Hizli ders', 'Bu musaitlik kartinda eksik sube, saat veya antrenor bilgisi var.');
      return;
    }

    const draft = {
      branchId,
      time,
      startDate: getNextScheduleStartDate(dayKey),
      days: [dayKey],
      trainerIds: [trainerKey],
      primaryTrainerId: trainerKey,
      quickCreate: true,
    };

    setSelectedBranchId(branchId);
    setSelectedDayKey(dayKey);
    setSelectedSlots([normalizedSlot]);
    setScheduleForm((current) => ({
      ...current,
      ...draft,
    }));
    scheduleMutation.mutate(draft);
  }

  if (scheduleQuery.isLoading) {
    return <LoadingBlock label="Program modulu yukleniyor..." />;
  }

  const data = scheduleQuery.data;

  return (
    <ScreenLayout title="Programlama" subtitle="Ders saatleri, fiyatlandirma, musaitlik sablonlari ve bitis takvimi.">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stack}>

        {/* HERO */}
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>📅 PROGRAMLAMA MERKEZİ</Text>
          <Text style={styles.heroTitle}>Ders akısını netlestir</Text>
          <Text style={styles.heroText}>Bitis takvimi artik ertelemeleri ve ozel ders kalan yoklama bilgisini web panelindeki mantikla gosterir.</Text>
        </View>

        {/* DERS SAATİ YÖNETİMİ */}
        <SectionHeader title="Ders saati yonetimi" caption="Coklu antrenorlu saat plani" />
        <View style={styles.cardTeal}>
          <Text style={styles.label}>Sube secimi</Text>
          <View style={styles.chipRow}>
            {data.branches.map((branch) => (
              <ActionButton key={branch.id} label={branch.name} variant={scheduleForm.branchId === branch.id ? 'primary' : 'secondary'} onPress={() => setScheduleForm((current) => ({ ...current, branchId: branch.id }))} />
            ))}
          </View>
          <TextInput style={styles.input} placeholder="Ozel program adi (istege bagli)" value={scheduleForm.customName} onChangeText={(text) => setScheduleForm((current) => ({ ...current, customName: text }))} />
          <TextInput style={styles.input} placeholder="Saat (18:00)" value={scheduleForm.time} onChangeText={(text) => setScheduleForm((current) => ({ ...current, time: text }))} />
          <TextInput style={styles.input} placeholder="Baslangic tarihi (YYYY-MM-DD)" value={scheduleForm.startDate} onChangeText={(text) => setScheduleForm((current) => ({ ...current, startDate: text }))} />
          <View style={styles.buttonRow}>
            <ActionButton label="Grup" variant={scheduleForm.lessonType === 'group' ? 'primary' : 'secondary'} onPress={() => setScheduleForm((current) => ({ ...current, lessonType: 'group' }))} />
            <ActionButton label="Ozel" variant={scheduleForm.lessonType === 'private' ? 'primary' : 'secondary'} onPress={() => setScheduleForm((current) => ({ ...current, lessonType: 'private' }))} />
          </View>
          <Text style={styles.label}>Ders gunleri</Text>
          <View style={styles.chipRow}>
            {dayOptions.map((day) => {
              const selected = scheduleForm.days.includes(day.key);
              return (
                <ActionButton
                  key={day.key}
                  label={day.label}
                  variant={selected ? 'primary' : 'secondary'}
                  onPress={() =>
                    setScheduleForm((current) => ({
                      ...current,
                      days: selected ? current.days.filter((item) => item !== day.key) : [...current.days, day.key],
                    }))
                  }
                />
              );
            })}
          </View>
          <Text style={styles.label}>Antrenor secimi</Text>
          <View style={styles.chipRow}>
            {data.trainers.map((trainer) => {
              const selected = scheduleForm.trainerIds.includes(trainer.uid || trainer.id);
              const trainerKey = trainer.uid || trainer.id;
              return (
                <ActionButton
                  key={trainer.id}
                  label={trainer.name || 'Antrenor'}
                  variant={selected ? 'primary' : 'secondary'}
                  onPress={() =>
                    setScheduleForm((current) => ({
                      ...current,
                      trainerIds: selected ? current.trainerIds.filter((item) => item !== trainerKey) : [...current.trainerIds, trainerKey],
                      primaryTrainerId: current.primaryTrainerId || trainerKey,
                    }))
                  }
                />
              );
            })}
          </View>
          <Text style={styles.label}>Bas antrenor</Text>
          <View style={styles.chipRow}>
            {scheduleForm.trainerIds.map((trainerId) => {
              const trainer = data.trainers.find((item) => item.uid === trainerId || item.id === trainerId);
              return (
                <ActionButton
                  key={trainerId}
                  label={trainer?.name || 'Antrenor'}
                  variant={scheduleForm.primaryTrainerId === trainerId ? 'primary' : 'secondary'}
                  onPress={() => setScheduleForm((current) => ({ ...current, primaryTrainerId: trainerId }))}
                />
              );
            })}
          </View>
          {scheduleForm.trainerIds
            .filter((trainerId) => trainerId && trainerId !== scheduleForm.primaryTrainerId)
            .map((assistantId) => {
              const assistant = data.trainers.find((item) => item.uid === assistantId || item.id === assistantId);
              const headOptions = scheduleForm.trainerIds.filter((trainerId) => trainerId !== assistantId);
              return (
                <View key={`assistant-head-${assistantId}`} style={styles.assistantHeadBlock}>
                  <Text style={styles.label}>{assistant?.name || 'Yardimci'} icin bas antrenor</Text>
                  <View style={styles.chipRow}>
                    {headOptions.map((headId) => {
                      const headTrainer = data.trainers.find((item) => item.uid === headId || item.id === headId);
                      const selected = scheduleForm.assistantHeadMap[assistantId] === headId;
                      return (
                        <ActionButton
                          key={`${assistantId}-${headId}`}
                          label={headTrainer?.name || 'Antrenor'}
                          variant={selected ? 'primary' : 'secondary'}
                          onPress={() =>
                            setScheduleForm((current) => ({
                              ...current,
                              assistantHeadMap: { ...current.assistantHeadMap, [assistantId]: headId },
                            }))
                          }
                        />
                      );
                    })}
                  </View>
                </View>
              );
            })}
          <TextInput style={styles.input} placeholder="Kapasite" keyboardType="numeric" value={scheduleForm.capacity} onChangeText={(text) => setScheduleForm((current) => ({ ...current, capacity: text }))} />
          <TextInput style={styles.input} placeholder="Ders sayisi" keyboardType="numeric" value={scheduleForm.lessonsCount} onChangeText={(text) => setScheduleForm((current) => ({ ...current, lessonsCount: text }))} />
          <ActionButton label={scheduleMutation.isPending ? 'Kaydediliyor...' : scheduleForm.id ? 'Ders Saatini Guncelle' : 'Ders Saati Ekle'} onPress={() => scheduleMutation.mutate()} fullWidth />
          {data.schedules.map((schedule) => (
            <View key={schedule.id} style={styles.scheduleCard}>
              <View style={styles.scheduleBadge}>
                <Text style={styles.scheduleBadgeText}>⏰ {schedule.displayLabel || schedule.time}</Text>
              </View>
              <Text style={styles.itemTitle}>{schedule.branchName}</Text>
              <Text style={styles.itemText}>{schedule.dayLabels}</Text>
              <Text style={styles.itemText}>{schedule.lessonType === 'private' ? '🔑 Ozel Ders' : '👥 Grup Dersi'}{schedule.postponementCount ? ` | ${schedule.postponementCount} erteleme` : ''}</Text>
              <Text style={styles.itemText}>👤 {schedule.trainerSummary || 'Antrenor yok'}</Text>
              <Text style={styles.itemText}>💳 {schedule.paymentSummary.paidLessons}/{schedule.paymentSummary.totalLessons} odeme kaydi</Text>
              <ActionButton
                label="Duzenle"
                variant="secondary"
                onPress={() =>
                  setScheduleForm({
                    id: schedule.id,
                    branchId: schedule.branchId || '',
                    customName: schedule.customName || '',
                    time: schedule.time || '',
                    lessonType: schedule.lessonType || 'group',
                    startDate: schedule.startDate || '',
                    days: schedule.days || ['monday'],
                    trainerIds: schedule.trainerIds || schedule.paymentSummary.assignments.map((item) => item.trainerId),
                    primaryTrainerId: schedule.trainerId || '',
                    assistantHeadMap: buildAssistantHeadMapFromSchedule(schedule),
                    capacity: String(schedule.capacity || 1),
                    lessonsCount: String(schedule.lessonsCount || 1),
                  })
                }
              />
            </View>
          ))}
        </View>

        {/* MÜSAİTLİK ŞABLONU */}
        <SectionHeader title="Musaitlik sablonu" caption="Sube ve gun bazli acik saat secimi" />
        <View style={styles.cardIndigo}>
          <Text style={styles.helperText}>Hizli ders ac butonlari mevcut ders tipi, kapasite ve ders sayisi ayarlarinizi kullanir.</Text>
          <Text style={styles.label}>Sube</Text>
          <View style={styles.chipRow}>
            {data.branches.map((branch) => (
              <ActionButton key={branch.id} label={branch.name} variant={selectedBranchId === branch.id ? 'primary' : 'secondary'} onPress={() => setSelectedBranchId(branch.id)} />
            ))}
          </View>
          <Text style={styles.label}>Gun</Text>
          <View style={styles.chipRow}>
            {dayOptions.map((day) => (
              <ActionButton key={day.key} label={day.label} variant={selectedDayKey === day.key ? 'primary' : 'secondary'} onPress={() => setSelectedDayKey(day.key)} />
            ))}
          </View>

          <View style={styles.slotHeaderRow}>
            <Text style={styles.label}>Saat secimi</Text>
            <View style={styles.slotHeaderActions}>
              <Pressable style={styles.slotQuickBtn} onPress={() => setSelectedSlots([...ALL_HOURS])}>
                <Text style={styles.slotQuickBtnText}>Tumu Sec</Text>
              </Pressable>
              <Pressable style={[styles.slotQuickBtn, styles.slotQuickBtnClear]} onPress={() => setSelectedSlots([])}>
                <Text style={[styles.slotQuickBtnText, styles.slotQuickBtnClearText]}>Temizle</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.hourGrid}>
            {ALL_HOURS.map((slot) => {
              const active = selectedSlots.includes(slot);
              return (
                <Pressable
                  key={slot}
                  onPress={() => toggleSlot(slot)}
                  style={[styles.hourBtn, active && styles.hourBtnActive]}
                >
                  <Text style={[styles.hourBtnText, active && styles.hourBtnTextActive]}>{slot}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.label}>Ozel saat araligi ekle</Text>
          <View style={styles.customSlotRow}>
            <TextInput
              style={[styles.input, styles.customSlotInput]}
              placeholder="Baslangic (01:30)"
              value={customSlotStart}
              onChangeText={setCustomSlotStart}
            />
            <TextInput
              style={[styles.input, styles.customSlotInput]}
              placeholder="Bitis (02:30)"
              value={customSlotEnd}
              onChangeText={setCustomSlotEnd}
            />
            <ActionButton label="Ekle" variant="secondary" onPress={addCustomSlot} />
          </View>
          {selectedSlots.length > 0 && (
            <View style={styles.selectedSlotDisplay}>
              <Text style={styles.selectedSlotLabel}>Secilen saatler:</Text>
              <Text style={styles.selectedSlotValue}>{sortSlots(selectedSlots).map(normalizeSlotLabel).join('  •  ')}</Text>
            </View>
          )}
          <ActionButton label={availabilityMutation.isPending ? 'Kaydediliyor...' : 'Sablonu Kaydet'} onPress={() => availabilityMutation.mutate()} fullWidth />
          {selectedTemplate?.dailySlots?.[selectedDayKey]?.length ? (
            <View style={styles.savedSlotsBox}>
              <Text style={styles.savedSlotsLabel}>✅ Kayitli slotlar:</Text>
              <Text style={styles.savedSlotsValue}>{sortSlots(selectedTemplate.dailySlots[selectedDayKey]).map(normalizeSlotLabel).join('  •  ')}</Text>
            </View>
          ) : (
            <Text style={styles.itemText}>Bu gun icin kayitli slot yok.</Text>
          )}
          {!data.availabilityPreferences.length ? (
            <EmptyState title="Musaitlik tercihi yok" description="Antrenorler henuz tercih girmemis." />
          ) : (
            data.availabilityPreferences.slice(0, 8).map((preference) => (
              <View key={preference.id} style={styles.prefCard}>
                <Text style={styles.prefName}>👤 {trainerNameMap.get(preference.trainerName) || trainerNameMap.get(preference.trainerId) || trainerNameMap.get(preference.trainerDocId) || preference.trainerName || 'Antrenor'}</Text>
                <Text style={styles.itemText}>{data.branches.find((item) => item.id === preference.branchId)?.name || preference.branchId}</Text>
                <Text style={styles.itemText}>{Object.entries(preference.dailySlots || {}).filter(([, slots]) => Array.isArray(slots) && slots.length).map(([day, slots]) => `${dayOptions.find((item) => item.key === day)?.label || day}: ${sortSlots(slots).map(normalizeSlotLabel).join(', ')}`).join(' | ') || 'Kayit yok'}</Text>
                {Object.entries(preference.dailySlots || {})
                  .filter(([, slots]) => Array.isArray(slots) && slots.length)
                  .map(([dayKey, slots]) => (
                    <View key={`${preference.id}_${dayKey}`} style={styles.quickCreateRow}>
                      <Text style={styles.quickCreateDay}>{dayOptions.find((item) => item.key === dayKey)?.label || dayKey}</Text>
                      <View style={styles.quickCreateChipRow}>
                        {sortSlots(slots).map((slot) => {
                          const normalizedSlot = normalizeSlotLabel(slot);
                          return (
                            <Pressable
                              key={`${preference.id}_${dayKey}_${normalizedSlot}`}
                              style={styles.quickCreateChip}
                              onPress={() => quickCreateFromPreference(preference, dayKey, slot)}
                            >
                              <Text style={styles.quickCreateChipLabel}>{normalizedSlot}</Text>
                              <Text style={styles.quickCreateChipText}>Hizli ders ac</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))}
              </View>
            ))
          )}
        </View>

        {/* FİYATLANDIRMA */}
        <SectionHeader title="Fiyatlandirma" caption="Sube ve saat bazli fiyat kaydi" />
        <View style={styles.cardAmber}>
          {!data.schedules.length ? (
            <EmptyState title="Ders saati yok" description="Fiyatlandirma icin once ders saati ekleyin." />
          ) : (
            data.schedules.map((schedule) => {
              const priceDoc = data.prices.find((item) => item.id === `${schedule.branchId}_${schedule.time}`);
              const stateKey = `${schedule.branchId}_${schedule.time}`;
              return (
                <View key={schedule.id} style={styles.inlineRow}>
                  <View style={styles.inlineBody}>
                    <Text style={styles.itemTitle}>{schedule.branchName} | {schedule.time}</Text>
                    <Text style={styles.itemText}>Mevcut fiyat: ₺{Number(priceDoc?.price || 0).toFixed(2)}</Text>
                  </View>
                  <TextInput
                    style={styles.priceInput}
                    keyboardType="numeric"
                    value={priceValues[stateKey] ?? String(priceDoc?.price || '')}
                    onChangeText={(text) => setPriceValues((current) => ({ ...current, [stateKey]: text }))}
                  />
                  <ActionButton label="Kaydet" onPress={() => priceMutation.mutate({ branchId: schedule.branchId, time: schedule.time, price: priceValues[stateKey] ?? String(priceDoc?.price || '') })} />
                </View>
              );
            })
          )}
        </View>

        {/* BİTİŞ TAKVİMİ */}
        <SectionHeader title="Ders bitis takvimi" caption="Ogrencilerin planlanan bitis tarihleri" />
        <View style={styles.cardRose}>
          {!data.completionCalendar.length ? (
            <EmptyState title="Takvim verisi yok" description="Aktif ogrenci veya bagli ders saati bulunmuyor." />
          ) : (
            data.completionCalendar.slice(0, 20).map((entry) => (
              <View key={entry.studentId} style={styles.calendarCard}>
                <Text style={styles.itemTitle}>{entry.studentName}</Text>
                <Text style={styles.itemText}>🏢 {entry.branchName} | ⏰ {entry.scheduleTime}</Text>
                <Text style={styles.itemText}>📅 Baslangic: {formatDate(entry.startDate)} | Bitis: {formatDate(entry.endDate)}</Text>
                {entry.isPrivateLesson ? <Text style={styles.itemText}>🔑 Ozel ders kalan: {entry.remainingLessons}</Text> : null}
                {entry.postponementCount ? <Text style={styles.itemText}>🔁 {entry.postponementCount} erteleme islendi</Text> : null}
                <Text style={[styles.itemText, entry.daysLeft < 0 ? styles.dangerText : styles.okText]}>
                  {entry.daysLeft < 0 ? '⚠️ Suresi doldu' : `✅ ${entry.daysLeft} gun kaldi`}
                </Text>
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
    paddingBottom: 24,
  },
  /* HERO */
  heroCard: {
    backgroundColor: '#0f3d6e',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 8,
  },
  heroEyebrow: {
    color: '#9fd3ff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
  },
  heroText: {
    color: '#b8d8f5',
    lineHeight: 20,
  },
  /* COLORED SECTION CARDS */
  cardTeal: {
    backgroundColor: '#edfaf6',
    borderColor: '#b8edd8',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 10,
  },
  cardIndigo: {
    backgroundColor: '#f0f0ff',
    borderColor: '#c9c5f8',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 10,
  },
  cardAmber: {
    backgroundColor: '#fffaeb',
    borderColor: '#f0d89a',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 10,
  },
  cardRose: {
    backgroundColor: '#fff3f6',
    borderColor: '#f5c6d4',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 10,
  },
  /* SCHEDULE CARD */
  assistantHeadBlock: {
    gap: 8,
    paddingTop: 4,
  },
  scheduleCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#b8edd8',
    borderLeftWidth: 4,
    borderLeftColor: '#1b7f5c',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
  },
  scheduleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1b7f5c',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 4,
  },
  scheduleBadgeText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  /* HOUR GRID */
  slotHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  slotQuickBtn: {
    backgroundColor: '#5b3fd4',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  slotQuickBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  slotQuickBtnClear: {
    backgroundColor: '#f0eeff',
    borderWidth: 1,
    borderColor: '#c9c5f8',
  },
  slotQuickBtnClearText: {
    color: '#5b3fd4',
  },
  hourGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hourBtn: {
    minWidth: 112,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#c9c5f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourBtnActive: {
    backgroundColor: '#5b3fd4',
    borderColor: '#5b3fd4',
  },
  hourBtnText: {
    fontWeight: '800',
    fontSize: 12,
    color: '#5b3fd4',
  },
  hourBtnTextActive: {
    color: '#ffffff',
  },
  customSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  customSlotInput: {
    minWidth: 120,
    flexGrow: 1,
  },
  selectedSlotDisplay: {
    backgroundColor: '#e8e4ff',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  selectedSlotLabel: {
    color: '#5b3fd4',
    fontWeight: '700',
    fontSize: 12,
  },
  selectedSlotValue: {
    color: '#3d2a99',
    fontWeight: '600',
    lineHeight: 20,
  },
  savedSlotsBox: {
    backgroundColor: '#d4f6ea',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  savedSlotsLabel: {
    color: '#1b7f5c',
    fontWeight: '700',
    fontSize: 12,
  },
  savedSlotsValue: {
    color: '#155c42',
    fontWeight: '600',
    lineHeight: 20,
  },
  helperText: {
    color: '#4a3c9b',
    fontWeight: '600',
    lineHeight: 20,
  },
  /* PREF / CALENDAR CARDs */
  prefCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#c9c5f8',
    borderLeftWidth: 4,
    borderLeftColor: '#5b3fd4',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
  },
  prefName: {
    color: '#3d2a99',
    fontWeight: '800',
    fontSize: 15,
  },
  quickCreateRow: {
    gap: 8,
    marginTop: 6,
  },
  quickCreateDay: {
    color: '#5b3fd4',
    fontWeight: '800',
    fontSize: 13,
  },
  quickCreateChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickCreateChip: {
    minWidth: 118,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ede8ff',
    borderWidth: 1,
    borderColor: '#c7bcff',
    gap: 2,
  },
  quickCreateChipLabel: {
    color: '#34217f',
    fontWeight: '900',
    fontSize: 13,
  },
  quickCreateChipText: {
    color: '#5b3fd4',
    fontWeight: '700',
    fontSize: 12,
  },
  calendarCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f5c6d4',
    borderLeftWidth: 4,
    borderLeftColor: '#c0365a',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
  },
  /* SHARED */
  itemCard: {
    backgroundColor: '#ffffff',
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
  label: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
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
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineBody: {
    flex: 1,
    gap: 2,
  },
  priceInput: {
    minWidth: 88,
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    color: theme.colors.text,
    backgroundColor: '#ffffff',
  },
  dangerText: {
    color: theme.colors.danger,
  },
  okText: {
    color: '#1b7f5c',
  },
});