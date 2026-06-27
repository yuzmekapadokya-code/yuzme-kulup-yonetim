import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import { theme } from '../../config/theme';
import {
  buildTrainerPerformanceReport,
  getTrainerPerformanceOverview,
  saveTrainerPerformance,
} from '../../services/trainerService';
import { useAuthStore } from '../../store/authStore';
import { sortByDateDesc, todayIsoDate } from '../../utils/date';

function normalizeGenderDisplay(gender) {
  const g = String(gender || '').toLowerCase();
  if (g === 'm' || g === 'male' || g === 'erkek') return 'Erkek';
  if (g === 'f' || g === 'female' || g === 'kadın' || g === 'kadin') return 'Kadın';
  return gender;
}

const styleOptions = ['Serbest', 'Sirt', 'Kurbaga', 'Kelebek', 'Karisik'];
const distanceMap = {
  Serbest: ['50', '100', '200', '400', '800', '1500'],
  Sirt: ['50', '100', '200'],
  Kurbaga: ['50', '100', '200'],
  Kelebek: ['50', '100', '200'],
  Karisik: ['100', '200', '400'],
};
const STUDENT_BATCH_SIZE = 24;
const REPORT_BATCH_SIZE = 8;
const STANDARD_GROUP_BATCH_SIZE = 10;

function normalizeSearchText(value) {
  return String(value || '').toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
}

function getStudentName(student) {
  return `${student?.name || ''} ${student?.surname || ''}`.trim() || 'Ogrenci';
}

function parseTimeInput(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (/^\d{1,2}:\d{2}\.\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{1,2}\.\d{2}$/.test(trimmed)) return `0:${trimmed.padStart(5, '0')}`;
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) return `${trimmed}.00`;
  return trimmed;
}

function timeToSeconds(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})\.(\d{1,2})$/);
  if (!match) return Number.NaN;
  return (Number(match[1]) * 60) + Number(match[2]) + (Number(match[3]) / 100);
}

function secondsToDisplay(totalSec) {
  if (!Number.isFinite(totalSec) || totalSec < 0) return '-';
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  const cs = Math.round((totalSec - Math.floor(totalSec)) * 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function formatTrend(trendSeconds) {
  if (!Number.isFinite(trendSeconds)) return null;
  const faster = trendSeconds > 0;
  return { faster, label: secondsToDisplay(Math.abs(trendSeconds)) };
}

function groupStandardsForDisplay(standards) {
  const groups = new Map();
  (standards || []).forEach((standard) => {
    const title = String(standard?.name || standard?.readableTitle || standard?.groupLabel || 'Baraj Dokumani').trim();
    const pool = standard?.poolType ? `${standard.poolType}m` : '-';
    const category = standard?.category || '-';
    const key = `${title}::${pool}::${category}`;
    if (!groups.has(key)) {
      groups.set(key, { key, title, pool, category, items: [] });
    }
    groups.get(key).items.push(standard);
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    items: [...group.items].sort((left, right) => Number(right.birthYear || 0) - Number(left.birthYear || 0)
      || String(left.gender || '').localeCompare(String(right.gender || ''), 'tr')
      || String(left.style || '').localeCompare(String(right.style || ''), 'tr')
      || Number(left.distance || 0) - Number(right.distance || 0)),
  }));
}

function groupPassedUpperAgeStandards(standards) {
  const grouped = new Map();

  (standards || []).forEach((standard) => {
    const title = String(
      standard?.name || standard?.readableTitle || standard?.groupLabel || 'Yaris'
    ).trim();
    const pool = standard?.poolType ? `${standard.poolType}m` : '';
    const category = standard?.category ? String(standard.category).trim() : '';
    const key = [title, pool, category].filter(Boolean).join(' | ');

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        title,
        pool,
        category,
        years: new Set(),
      });
    }

    const year = Number(standard?.birthYear);
    if (Number.isFinite(year)) {
      grouped.get(key).years.add(year);
    }
  });

  return Array.from(grouped.values()).map((item) => ({
    ...item,
    years: Array.from(item.years).sort((left, right) => right - left),
  }));
}

export default function TrainerPerformanceOpsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();

  const performanceQuery = useQuery({
    queryKey: ['tr-performance', profile?.uid],
    queryFn: () => getTrainerPerformanceOverview(profile),
    enabled: Boolean(profile?.uid),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const data = performanceQuery.data || {
    branches: [],
    schedules: [],
    students: [],
    performances: [],
    standards: [],
  };

  const [branchId, setBranchId] = useState('');
  const [scheduleId, setScheduleId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [type, setType] = useState('training');
  const [style, setStyle] = useState('Serbest');
  const [distance, setDistance] = useState('50');
  const [timeRaw, setTimeRaw] = useState('');
  const [date, setDate] = useState(todayIsoDate());
  const [expandedStandardGroups, setExpandedStandardGroups] = useState({});
  const [studentSearch, setStudentSearch] = useState('');
  const [visibleStudentCount, setVisibleStudentCount] = useState(STUDENT_BATCH_SIZE);
  const [reportScope, setReportScope] = useState('selected');
  const [visibleReportCount, setVisibleReportCount] = useState(REPORT_BATCH_SIZE);
  const [visibleStandardGroupCount, setVisibleStandardGroupCount] = useState(STANDARD_GROUP_BATCH_SIZE);
  // Barajlar filtreleri
  const [standardFilterBirthYear, setStandardFilterBirthYear] = useState('');
  const [standardFilterGender, setStandardFilterGender] = useState('');
  const [standardFilterStyle, setStandardFilterStyle] = useState('');
  const [standardFilterDistance, setStandardFilterDistance] = useState('');

  const time = parseTimeInput(timeRaw);

  useEffect(() => {
    if (data.branches.length && !branchId) setBranchId(data.branches[0].id);
  }, [data.branches, branchId]);

  const filteredSchedules = useMemo(
    () => data.schedules.filter((item) => !branchId || item.branchId === branchId),
    [data.schedules, branchId],
  );

  const filteredStudents = useMemo(() => data.students.filter((student) => {
    if (!scheduleId && !branchId) return true;
    if (scheduleId) return student.scheduleId === scheduleId;
    return filteredSchedules.some((schedule) => schedule.id === student.scheduleId);
  }), [branchId, data.students, filteredSchedules, scheduleId]);
  const deferredFilteredStudents = useDeferredValue(filteredStudents);
  const deferredStudentSearch = useDeferredValue(studentSearch);

  useEffect(() => {
    if (filteredSchedules.length && !filteredSchedules.some((item) => item.id === scheduleId)) setScheduleId(filteredSchedules[0].id);
    if (!filteredSchedules.length) setScheduleId('');
  }, [filteredSchedules, scheduleId]);

  useEffect(() => {
    if (filteredStudents.length && !filteredStudents.some((item) => item.id === studentId)) setStudentId(filteredStudents[0].id);
    if (!filteredStudents.length) setStudentId('');
  }, [filteredStudents, studentId]);

  useEffect(() => {
    const availableDistances = distanceMap[style] || ['50'];
    if (!availableDistances.includes(distance)) setDistance(availableDistances[0]);
  }, [style, distance]);

  const normalizedStudentSearch = normalizeSearchText(deferredStudentSearch);
  const searchedStudents = useMemo(() => {
    if (!normalizedStudentSearch) {
      return filteredStudents;
    }

    return filteredStudents.filter((student) => normalizeSearchText(getStudentName(student)).includes(normalizedStudentSearch));
  }, [filteredStudents, normalizedStudentSearch]);

  useEffect(() => {
    setVisibleStudentCount(STUDENT_BATCH_SIZE);
  }, [branchId, scheduleId, normalizedStudentSearch]);

  const selectedStudent = filteredStudents.find((item) => item.id === studentId) || null;
  const selectedStudentName = selectedStudent ? getStudentName(selectedStudent) : '';
  const visibleStudents = useMemo(() => {
    const sliced = searchedStudents.slice(0, visibleStudentCount);
    if (!selectedStudent || sliced.some((student) => student.id === selectedStudent.id)) {
      return sliced;
    }

    return [selectedStudent, ...sliced].filter(
      (student, index, list) => list.findIndex((candidate) => candidate.id === student.id) === index,
    );
  }, [searchedStudents, selectedStudent, visibleStudentCount]);

  const filteredStudentIds = useMemo(
    () => new Set(filteredStudents.map((student) => student.id)),
    [filteredStudents],
  );

  const filteredPerformances = useMemo(
    () => data.performances.filter((item) => filteredStudentIds.has(item.studentId)),
    [data.performances, filteredStudentIds],
  );
  const reportStudents = useMemo(() => {
    if (reportScope === 'selected' && selectedStudent) {
      return [selectedStudent];
    }

    return filteredStudents;
  }, [filteredStudents, reportScope, selectedStudent]);
  const reportStudentIds = useMemo(
    () => new Set(reportStudents.map((student) => student.id)),
    [reportStudents],
  );
  const reportPerformances = useMemo(
    () => data.performances.filter((item) => reportStudentIds.has(item.studentId)),
    [data.performances, reportStudentIds],
  );
  const deferredReportStudents = useDeferredValue(reportStudents);
  const deferredReportPerformances = useDeferredValue(reportPerformances);
  const deferredStandards = useDeferredValue(data.standards);
  const reportIsRefreshing = deferredFilteredStudents !== filteredStudents
    || deferredReportStudents !== reportStudents
    || deferredReportPerformances !== reportPerformances
    || deferredStandards !== data.standards;

  const report = useMemo(
    () => buildTrainerPerformanceReport(deferredReportStudents, deferredReportPerformances, deferredStandards),
    [deferredReportStudents, deferredReportPerformances, deferredStandards],
  );
  const visibleReport = useMemo(
    () => (reportScope === 'selected' ? report : report.slice(0, visibleReportCount)),
    [report, reportScope, visibleReportCount],
  );

  useEffect(() => {
    setVisibleReportCount(REPORT_BATCH_SIZE);
  }, [branchId, scheduleId, studentId, reportScope]);

  const selectedStudentPerformances = useMemo(
    () => filteredPerformances.filter((item) => item.studentId === studentId),
    [filteredPerformances, studentId],
  );
  const deferredStudentPerformances = useDeferredValue(selectedStudentPerformances);
  // Barajlar filtre mantığı
  const filteredStandards = useMemo(() => {
    return (data.standards || []).filter((standard) => {
      if (standardFilterBirthYear && String(standard.birthYear) !== String(standardFilterBirthYear)) return false;
      if (standardFilterGender && String(standard.gender).toLowerCase() !== String(standardFilterGender).toLowerCase()) return false;
      if (standardFilterStyle && String(standard.style).toLowerCase() !== String(standardFilterStyle).toLowerCase()) return false;
      if (standardFilterDistance && String(standard.distance) !== String(standardFilterDistance)) return false;
      return true;
    });
  }, [data.standards, standardFilterBirthYear, standardFilterGender, standardFilterStyle, standardFilterDistance]);
  const groupedFilteredStandards = useMemo(() => groupStandardsForDisplay(filteredStandards), [filteredStandards]);

  useEffect(() => {
    setVisibleStandardGroupCount(STANDARD_GROUP_BATCH_SIZE);
  }, [standardFilterBirthYear, standardFilterDistance, standardFilterGender, standardFilterStyle]);

  const performanceMutation = useMutation({
    mutationFn: () => saveTrainerPerformance({ profile, studentId, style, distance, time, date, type }),
    onSuccess: (createdPerformance) => {
      setTimeRaw('');
      setDate(todayIsoDate());
      queryClient.setQueryData(['tr-performance', profile?.uid], (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          performances: sortByDateDesc([
            createdPerformance,
            ...(current.performances || []),
          ], 'date'),
        };
      });
    },
    onError: (error) => Alert.alert('Performans', error.message || 'Derece kaydedilemedi.'),
  });

  if (performanceQuery.isLoading) {
    return <LoadingBlock label="Performans verileri yukleniyor..." />;
  }

  if (performanceQuery.isError) {
    return (
      <ScreenLayout title="Performans" subtitle="Veriler alinamadi.">
        <EmptyState title="Hata" description={performanceQuery.error?.message || 'Performans verileri yuklenemedi.'} />
        <ActionButton label="Tekrar dene" onPress={() => performanceQuery.refetch()} fullWidth />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout title="Performans" subtitle="Derece girisi, rapor ve baraj takibi.">
      <ActionButton
        label={performanceQuery.isFetching ? 'Yukleniyor...' : 'Verileri Yenile'}
        variant="secondary"
        onPress={() => performanceQuery.refetch()}
        disabled={performanceQuery.isFetching}
        fullWidth
      />

      <SectionHeader title="Filtreler" caption="Sube, ders ve sporcu sec" />
      <View style={styles.card}>
        <Text style={styles.label}>Sube</Text>
        <View style={styles.chipRow}>
          {data.branches.map((branch) => (
            <ActionButton key={branch.id} label={branch.name} variant={branchId === branch.id ? 'primary' : 'secondary'} onPress={() => setBranchId(branch.id)} />
          ))}
        </View>

        <Text style={styles.label}>Saat grubu</Text>
        <View style={styles.chipRow}>
          {filteredSchedules.map((schedule) => (
            <ActionButton key={schedule.id} label={schedule.time || '-'} variant={scheduleId === schedule.id ? 'primary' : 'secondary'} onPress={() => setScheduleId(schedule.id)} />
          ))}
        </View>

        <Text style={styles.label}>Sporcu</Text>
        <TextInput
          style={styles.input}
          placeholder="Sporcu ara"
          value={studentSearch}
          onChangeText={setStudentSearch}
        />
        <View style={styles.chipRow}>
          {visibleStudents.map((student) => {
            const name = getStudentName(student);
            return <ActionButton key={student.id} label={name} variant={studentId === student.id ? 'primary' : 'secondary'} onPress={() => setStudentId(student.id)} />;
          })}
        </View>
        {!visibleStudents.length ? <Text style={styles.helperText}>Bu filtreye uygun sporcu bulunamadi.</Text> : null}
        {searchedStudents.length > visibleStudents.length ? (
          <ActionButton
            label={`Daha fazla sporcu goster (${searchedStudents.length - visibleStudents.length})`}
            variant="secondary"
            onPress={() => setVisibleStudentCount((current) => current + STUDENT_BATCH_SIZE)}
            fullWidth
          />
        ) : null}
      </View>

      <SectionHeader title="Yeni derece" caption="Secilen sporcuya performans kaydi ekle" />
      <View style={styles.card}>
        <Text style={styles.itemText}>Secili sporcu: {selectedStudentName || '-'}</Text>
        <Text style={styles.label}>Stil</Text>
        <View style={styles.chipRow}>
          {styleOptions.map((item) => (
            <ActionButton key={item} label={item} variant={style === item ? 'primary' : 'secondary'} onPress={() => setStyle(item)} />
          ))}
        </View>

        <Text style={styles.label}>Mesafe</Text>
        <View style={styles.chipRow}>
          {(distanceMap[style] || ['50']).map((item) => (
            <ActionButton key={item} label={`${item}m`} variant={distance === item ? 'primary' : 'secondary'} onPress={() => setDistance(item)} />
          ))}
        </View>

        <Text style={styles.label}>Tip</Text>
        <View style={styles.chipRow}>
          {[
            { key: 'training', label: 'Antrenman derecesi' },
            { key: 'competition', label: 'Yaris derecesi' },
          ].map((item) => (
            <ActionButton
              key={item.key}
              label={item.label}
              variant={type === item.key ? 'primary' : 'secondary'}
              onPress={() => setType(item.key)}
            />
          ))}
        </View>

        <TextInput style={styles.input} placeholder="Sure (or. 1:20.45 veya 20.45)" value={timeRaw} onChangeText={setTimeRaw} />
        <TextInput style={styles.input} placeholder="Tarih" value={date} onChangeText={setDate} />
        <Text style={styles.itemText}>Yorumlanan sure: {time || '-'}</Text>

        <ActionButton
          label={performanceMutation.isPending ? 'Kaydediliyor...' : 'Performansi Kaydet'}
          onPress={() => {
            if (!studentId) return Alert.alert('Performans', 'Sporcu secin.');
            if (!time) return Alert.alert('Performans', 'Gecerli sure girin. Ornek: 1:20.45');
            performanceMutation.mutate();
          }}
          disabled={performanceMutation.isPending}
          fullWidth
        />
      </View>

      <SectionHeader title="Rapor" caption="Sporcu bazli son durum ve baraj" />
      <View style={styles.card}>
        <Text style={styles.label}>Rapor kapsami</Text>
        <View style={styles.chipRow}>
          <ActionButton
            label={selectedStudentName ? 'Secili sporcu' : 'Secili sporcu yok'}
            variant={reportScope === 'selected' ? 'primary' : 'secondary'}
            onPress={() => setReportScope('selected')}
            disabled={!selectedStudent}
          />
          <ActionButton
            label={`Tum filtrelenen sporcular (${filteredStudents.length})`}
            variant={reportScope === 'all' ? 'primary' : 'secondary'}
            onPress={() => setReportScope('all')}
          />
        </View>
        {reportIsRefreshing ? <Text style={styles.helperText}>Rapor yeniden hesaplanirken onceki sonuc gosteriliyor.</Text> : null}
        {!report.length ? (
          <EmptyState title="Veri yok" description="Filtrelere uygun performans bulunamadi." />
        ) : visibleReport.map(({ student, summary }) => (
          <View key={student.id} style={styles.subCard}>
            <Text style={styles.itemTitle}>{getStudentName(student)}</Text>
            {summary.length === 0 ? (
              <Text style={styles.itemText}>Kayit yok</Text>
            ) : summary.map((item) => {
              const trend = formatTrend(item.trendSeconds);
              const status = item.standardStatus;
              const passed = status?.passed === true;
              const matchedStandard = status?.standard || null;
              const olderPassedStandards = (status?.passedStandards || []).filter(
                (standard) => Number(standard?.birthYear) < Number(student.birthYear)
              );
              const groupedOlderPassedStandards = groupPassedUpperAgeStandards(olderPassedStandards);
              // Açık yaş mantığı
              let acikYas = '';
              if (matchedStandard?.ageGroupToken && String(matchedStandard.ageGroupToken).endsWith('+')) {
                acikYas = `Acik Yas (${matchedStandard.birthYear}+): Dogum yili <= ${matchedStandard.birthYear} olanlar bu kategoriye girer. 2008, 2009 gibi daha sonraki dogum yillari girmez.`;
              }
              // Baraj geçme detayı
              let barajDetay = '';
              if (passed && status?.label && matchedStandard?.time && item.latest?.time) {
                const barajSec = timeToSeconds(matchedStandard.time);
                const sporcuSec = timeToSeconds(item.latest?.time);
                const fark = secondsToDisplay(barajSec - sporcuSec);
                barajDetay = `${status.barajName || 'Baraj'} seviyesi ${item.latest?.time} ile ${fark} farkla gecildi.`;
              } else if (!passed && status?.label && matchedStandard?.time && item.latest?.time) {
                const barajSec = timeToSeconds(matchedStandard.time);
                const sporcuSec = timeToSeconds(item.latest?.time);
                const fark = secondsToDisplay(sporcuSec - barajSec);
                barajDetay = `${status.barajName || 'Baraj'} seviyesi ${fark} farkla kacirildi.`;
              } else if (!passed && status?.label) {
                barajDetay = `${status.label} baraji icin ${item.latest?.time || '-'} yeterli degil.`;
              }
              return (
                <View key={item.key} style={[styles.reportRow, passed ? styles.reportRowPassed : styles.reportRowMissed]}>
                  <Text style={styles.reportBadge}>{passed ? 'OK' : 'NO'}</Text>
                  <View style={styles.flexOne}>
                    <Text style={styles.itemTitle}>{
                      item.key.split('_').map((part, idx) => {
                        if (idx === 2) {
                          return part === 'competition' ? 'YARIS' : 'ANTRENMAN';
                        }
                        return idx === 1 ? `${part}m` : part;
                      }).join(' | ')
                    }</Text>
                    <Text style={styles.itemText}>En iyi: {item.best?.time || '-'}</Text>
                    <Text style={styles.itemText}>Son: {item.latest?.time || '-'}</Text>
                    {trend ? <Text style={[styles.itemText, trend.faster ? styles.arrowFaster : styles.arrowSlower]}>{trend.faster ? '▲' : '▼'} {trend.label}</Text> : null}
                    <Text style={passed ? styles.barajPassed : styles.barajMissed}>{status?.label || 'Eslesen baraj yok'}</Text>
                    {acikYas ? <Text style={styles.itemText}>{acikYas}</Text> : null}
                    {groupedOlderPassedStandards.length ? (
                      <View style={styles.passedRaceList}>
                        {groupedOlderPassedStandards.map((race) => (
                          <Text key={race.key} style={styles.itemText}>
                            {race.title}: {race.years.join(', ')}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    {barajDetay ? <Text style={styles.itemText}>{barajDetay}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
        {reportScope === 'all' && report.length > visibleReport.length ? (
          <ActionButton
            label={`Daha fazla rapor goster (${report.length - visibleReport.length})`}
            variant="secondary"
            onPress={() => setVisibleReportCount((current) => current + REPORT_BATCH_SIZE)}
            fullWidth
          />
        ) : null}
      </View>

      <SectionHeader title="Barajlar" caption="Dokuman bazli gruplanmis liste" />
      <View style={styles.card}>
        {/* Barajlar filtre alanları */}
        <Text style={styles.label}>Yaş (Doğum Yılı)</Text>
        <TextInput style={styles.input} placeholder="Örn. 2010" value={standardFilterBirthYear} onChangeText={setStandardFilterBirthYear} />
        <Text style={styles.label}>Cinsiyet</Text>
        <View style={styles.chipRow}>
          {['', 'Erkek', 'Kadın'].map((g) => (
            <ActionButton key={g} label={g === '' ? 'Tümü' : g} variant={standardFilterGender === g ? 'primary' : 'secondary'} onPress={() => setStandardFilterGender(g)} />
          ))}
        </View>
        <Text style={styles.label}>Stil</Text>
        <View style={styles.chipRow}>
          {['', ...styleOptions].map((s) => (
            <ActionButton key={s} label={s === '' ? 'Tümü' : s} variant={standardFilterStyle === s ? 'primary' : 'secondary'} onPress={() => setStandardFilterStyle(s)} />
          ))}
        </View>
        <Text style={styles.label}>Mesafe</Text>
        <View style={styles.chipRow}>
          {['', '50', '100', '200', '400', '800', '1500'].map((d) => (
            <ActionButton key={d} label={d === '' ? 'Tümü' : `${d}m`} variant={standardFilterDistance === d ? 'primary' : 'secondary'} onPress={() => setStandardFilterDistance(d)} />
          ))}
        </View>
        {/* Barajlar listesi Swimrank benzeri */}
        {!groupedFilteredStandards.length ? (
          <EmptyState title="Baraj yok" description="Filtreye uygun standart kaydi bulunmuyor." />
        ) : groupedFilteredStandards.slice(0, visibleStandardGroupCount).map((group) => {
          // Varsayılan olarak tüm gruplar kapalı
          const expanded = Boolean(expandedStandardGroups[group.key]);
          // Grup başlığı: isim, mesafe, katılım/harcırah (kayıt sayısı yok)
          const katilimCount = group.items.filter(item => String(item.category).toLowerCase().includes('katılım')).length;
          const harcirahCount = group.items.filter(item => String(item.category).toLowerCase().includes('harcırah')).length;
          const acikYas = group.items.some(item => String(item.ageGroupToken || '').endsWith('+')) ? 'Açık Yaş' : '';
          let meta = '';
          if (katilimCount && harcirahCount) meta = `Katılım | Harcırah`;
          else if (katilimCount) meta = `Katılım`;
          else if (harcirahCount) meta = `Harcırah`;
          if (acikYas) meta += (meta ? ' | ' : '') + acikYas;
          return (
            <View key={group.key} style={styles.subCard}>
              <ActionButton
                label={`${group.title} | ${group.pool} | ${meta}`}
                variant="secondary"
                onPress={() => setExpandedStandardGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                fullWidth
              />
              {expanded ? (
                <View style={{marginTop:8}}>
                  {group.items.map((standard) => (
                    <View key={standard.id} style={styles.standardItemRow}>
                      <Text style={styles.itemText}>{standard.birthYear} | {normalizeGenderDisplay(standard.gender)} | {standard.style} | {standard.distance}m</Text>
                      <Text style={styles.itemText}>Süre: {standard.time}</Text>
                      {/* Baraj geçme detayı ve açık yaş mantığı için altyapı */}
                      {String(standard.ageGroupToken || '').endsWith('+') ? (
                        <Text style={styles.itemText}>Açık Yaş: {standard.ageGroupToken}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
        {groupedFilteredStandards.length > visibleStandardGroupCount ? (
          <ActionButton
            label={`Daha fazla baraj goster (${groupedFilteredStandards.length - visibleStandardGroupCount})`}
            variant="secondary"
            onPress={() => setVisibleStandardGroupCount((current) => current + STANDARD_GROUP_BATCH_SIZE)}
            fullWidth
          />
        ) : null}
      </View>

      <SectionHeader title="Sporcu gecmisi" caption={selectedStudentName ? `${selectedStudentName} icin son kayitlar` : 'Secilen sporcunun kayitlari'} />
      <View style={styles.card}>
        {!deferredStudentPerformances.length ? (
          <EmptyState title="Gecmis yok" description="Bu sporcu icin performans gecmisi bulunmuyor." />
        ) : deferredStudentPerformances.slice(0, 20).map((entry, index) => (
          <View key={`${entry.id || index}_${entry.date || index}`} style={styles.subCard}>
            <Text style={styles.itemTitle}>{entry.style} | {entry.distance}m | {entry.type || 'training'}</Text>
            <Text style={styles.itemText}>{entry.date || '-'} | {entry.time || '-'}</Text>
          </View>
        ))}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  subCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d7e2ef',
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  label: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  itemTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 13,
  },
  itemText: {
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    color: theme.colors.text,
  },
  reportRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
  },
  reportRowPassed: {
    backgroundColor: '#ebf9f0',
    borderWidth: 1,
    borderColor: '#b5e7c7',
  },
  reportRowMissed: {
    backgroundColor: '#fff0f0',
    borderWidth: 1,
    borderColor: '#f5c1c1',
  },
  reportBadge: {
    color: theme.colors.primaryDeep,
    fontWeight: '900',
    width: 28,
    textAlign: 'center',
  },
  flexOne: {
    flex: 1,
  },
  passedRaceList: {
    gap: 4,
    marginTop: 4,
  },
  barajPassed: {
    color: '#0f7a2e',
    fontWeight: '800',
  },
  barajMissed: {
    color: '#ad1f2d',
    fontWeight: '800',
  },
  arrowFaster: {
    color: '#0f7a2e',
    fontWeight: '800',
  },
  arrowSlower: {
    color: '#ad1f2d',
    fontWeight: '800',
  },
  standardItemRow: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    paddingTop: 8,
  },
  moreHint: {
    marginTop: 8,
    color: theme.colors.primaryDeep,
    fontWeight: '700',
  },
  helperText: {
    color: theme.colors.textMuted,
    lineHeight: 19,
  },
});
