import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import { theme } from '../../config/theme';
import {
	getTrainerClassesOverview,
	postponeTrainerLesson,
	saveTrainerAvailability,
	saveTrainerComment,
	toggleTrainerLessonAttendance,
} from '../../services/trainerService';
import { useAuthStore } from '../../store/authStore';
import { todayIsoDate } from '../../utils/date';

const dayOptions = [
	{ key: 'monday', label: 'Pzt' },
	{ key: 'tuesday', label: 'Sali' },
	{ key: 'wednesday', label: 'Cars' },
	{ key: 'thursday', label: 'Pers' },
	{ key: 'friday', label: 'Cuma' },
	{ key: 'saturday', label: 'Cmt' },
	{ key: 'sunday', label: 'Pzr' },
];

const panelOptions = [
	{ key: 'attendance', label: 'Yoklama' },
	{ key: 'postpone', label: 'Erteleme' },
	{ key: 'comment', label: 'Yorum' },
	{ key: 'availability', label: 'Musaitlik' },
	{ key: 'completion', label: 'Bitis' },
];

const dayToJsMap = {
	sunday: 0,
	monday: 1,
	tuesday: 2,
	wednesday: 3,
	thursday: 4,
	friday: 5,
	saturday: 6,
};

function parseDateValue(value) {
	if (!value) return null;
	if (typeof value?.toDate === 'function') return value.toDate();
	if (typeof value === 'object' && typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(value) {
	const date = parseDateValue(value);
	if (!date) return '';
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function monthKey(value) {
	const date = parseDateValue(value);
	if (!date) return '';
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(value) {
	if (!value) return '-';
	const [year, month] = value.split('-').map(Number);
	return new Date(year, month - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

function normalizeScheduleDays(schedule) {
	if (Array.isArray(schedule?.days) && schedule.days.length) return schedule.days;
	if (Array.isArray(schedule?.scheduleDays) && schedule.scheduleDays.length) return schedule.scheduleDays;
	if (typeof schedule?.day === 'string' && schedule.day.trim()) return [schedule.day.trim()];
	return [];
}

function lessonCount(schedule) {
	const count = Number(schedule?.lessonsCount || 1);
	return Number.isFinite(count) && count > 0 ? count : 1;
}

function postponementCount(schedule) {
	if (Array.isArray(schedule?.postponements)) return schedule.postponements.length;
	const count = Number(schedule?.postponementCount || 0);
	return Number.isFinite(count) && count > 0 ? count : 0;
}

function calculateLessonDatesFromStart(startDate, scheduleDays, count) {
	const uniqueDays = [...new Set((scheduleDays || []).map((key) => dayToJsMap[key]).filter((day) => day !== null && typeof day !== 'undefined'))];
	const targetDays = uniqueDays.length ? uniqueDays : [1];
	const dates = [];
	const cursor = new Date(startDate.getTime());
	cursor.setHours(0, 0, 0, 0);
	let guard = 0;

	while (dates.length < count && guard < 4000) {
		if (targetDays.includes(cursor.getDay())) {
			dates.push(new Date(cursor.getTime()));
		}
		cursor.setDate(cursor.getDate() + 1);
		guard += 1;
	}

	return dates;
}

function getSchedulePostponableDates(schedule) {
	if (!schedule) return [];
	const startDate = parseDateValue(schedule.startDate) || parseDateValue(schedule.createdAt) || new Date();
	startDate.setHours(0, 0, 0, 0);
	const plannedDates = calculateLessonDatesFromStart(
		startDate,
		normalizeScheduleDays(schedule),
		lessonCount(schedule) + postponementCount(schedule)
	);
	const postponedIso = new Set(
		(Array.isArray(schedule.postponements) ? schedule.postponements : [])
			.map((item) => item?.date)
			.filter(Boolean)
	);

	return plannedDates
		.map((date) => ({
			date,
			iso: toIsoDate(date),
			dayLabel: date.toLocaleDateString('tr-TR', { weekday: 'short' }),
		}))
		.filter((item) => !postponedIso.has(item.iso));
}

function lessonColors(state) {
	if (state === true) return { backgroundColor: '#dff5e9', borderColor: '#8fd3ad', color: '#137a4d', label: '✓' };
	if (state === false) return { backgroundColor: '#fdeaea', borderColor: '#f2b9b9', color: '#b42318', label: '✗' };
	return { backgroundColor: '#eef3f8', borderColor: '#d5e0ea', color: '#61788f', label: '?' };
}

export default function TrainerClassOpsScreen() {
	const profile = useAuthStore((state) => state.profile);
	const queryClient = useQueryClient();
	const classesQuery = useQuery({
		queryKey: ['tr-classes', profile?.uid],
		queryFn: () => getTrainerClassesOverview(profile),
		enabled: Boolean(profile?.uid),
		staleTime: 30000,
		gcTime: 5 * 60000,
		refetchOnWindowFocus: false,
	});

	const [selectedBranchId, setSelectedBranchId] = useState('');
	const [selectedDay, setSelectedDay] = useState('monday');
	const [selectedSlots, setSelectedSlots] = useState([]);
	const [selectedScheduleId, setSelectedScheduleId] = useState('');
	const [selectedStudentId, setSelectedStudentId] = useState('');
	const [commentTopic, setCommentTopic] = useState('');
	const [commentText, setCommentText] = useState('');
	const [commentDate, setCommentDate] = useState(todayIsoDate());
	const [postponeDate, setPostponeDate] = useState('');
	const [postponeReason, setPostponeReason] = useState('');
	const [panelKey, setPanelKey] = useState('attendance');
	const [calendarMonthIndex, setCalendarMonthIndex] = useState(0);
	const [localAttendanceMap, setLocalAttendanceMap] = useState({});

	function invalidate() {
		queryClient.invalidateQueries({ queryKey: ['tr-classes', profile.uid] });
		queryClient.invalidateQueries({ queryKey: ['tr-dashboard', profile.uid] });
	}

	useEffect(() => {
		if (classesQuery.data?.branches?.length && !selectedBranchId) {
			setSelectedBranchId(classesQuery.data.branches[0].id);
		}
	}, [classesQuery.data, selectedBranchId]);

	useEffect(() => {
		if (classesQuery.data?.schedules?.length && !selectedScheduleId) {
			setSelectedScheduleId(classesQuery.data.schedules[0].id);
		}
	}, [classesQuery.data, selectedScheduleId]);

	useEffect(() => {
		const grouped = classesQuery.data?.groupedSchedules || [];
		const students = grouped.find((item) => item.schedule.id === selectedScheduleId)?.students || [];
		if (students.length && !students.some((item) => item.id === selectedStudentId)) {
			setSelectedStudentId(students[0].id);
		}
		if (!students.length) {
			setSelectedStudentId('');
		}
	}, [classesQuery.data, selectedScheduleId, selectedStudentId]);

	useEffect(() => {
		const branchPrefs = classesQuery.data?.preferenceByBranch?.[selectedBranchId]?.dailySlots || {};
		setSelectedSlots(branchPrefs[selectedDay] || []);
	}, [classesQuery.data, selectedBranchId, selectedDay]);

	useEffect(() => {
		setLocalAttendanceMap(classesQuery.data?.attendanceMap || {});
	}, [classesQuery.data?.attendanceMap]);

	const availabilityMutation = useMutation({
		mutationFn: () => saveTrainerAvailability({ profile, branchId: selectedBranchId, dayKey: selectedDay, slots: selectedSlots }),
		onSuccess: invalidate,
		onError: (error) => Alert.alert('Musaitlik', error.message || 'Kayit tamamlanamadi.'),
	});

	const attendanceMutation = useMutation({
		mutationFn: ({ studentId, lessonNumber, nextState }) => toggleTrainerLessonAttendance({ profile, studentId, scheduleId: selectedScheduleId, lessonNumber, nextState }),
		onMutate: ({ studentId, lessonNumber, nextState }) => {
			const key = `${studentId}_${lessonNumber}`;
			const previous = localAttendanceMap[key];
			setLocalAttendanceMap((current) => ({ ...current, [key]: nextState }));
			return { key, previous };
		},
		onSuccess: invalidate,
		onError: (error, _vars, context) => {
			if (context?.key) {
				setLocalAttendanceMap((current) => {
					const next = { ...current };
					if (typeof context.previous === 'undefined') {
						delete next[context.key];
					} else {
						next[context.key] = context.previous;
					}
					return next;
				});
			}
			Alert.alert('Yoklama', error.message || 'Yoklama guncellenemedi.');
		},
	});

	const commentMutation = useMutation({
		mutationFn: () => saveTrainerComment({ profile, studentId: selectedStudentId, topic: commentTopic, comment: commentText, lessonDate: commentDate }),
		onSuccess: () => {
			setCommentTopic('');
			setCommentText('');
			setCommentDate(todayIsoDate());
			invalidate();
		},
		onError: (error) => Alert.alert('Yorum', error.message || 'Yorum kaydedilemedi.'),
	});

	const postponeMutation = useMutation({
		mutationFn: () => postponeTrainerLesson({ profile, scheduleId: selectedScheduleId, postponeDate, reason: postponeReason }),
		onSuccess: () => {
			setPostponeReason('');
			invalidate();
		},
		onError: (error) => Alert.alert('Ders erteleme', error.message || 'Erteleme kaydedilemedi.'),
	});

	if (classesQuery.isLoading) {
		return <LoadingBlock label="Ders akis modulu yukleniyor..." />;
	}

	if (classesQuery.isError || !classesQuery.data) {
		return (
			<ScreenLayout title="Ders Akislari" subtitle="Veri alinirken hata olustu.">
				<EmptyState
					title="Ders akisi modulu acilamadi"
					description={classesQuery.error?.message || 'Ders, yoklama veya musaitlik verileri okunurken hata olustu.'}
				/>
				<ActionButton label="Tekrar Dene" onPress={() => classesQuery.refetch()} fullWidth />
			</ScreenLayout>
		);
	}

	const data = classesQuery.data;
	const selectedTemplate = data.availabilityTemplates[selectedBranchId] || {};
	const availableSlots = selectedTemplate[selectedDay] || [];
	const selectedGroup = data.groupedSchedules.find((item) => item.schedule.id === selectedScheduleId) || null;
	const selectedStudents = selectedGroup?.students || [];

	function toggleSlot(slot) {
		setSelectedSlots((current) => (current.includes(slot) ? current.filter((item) => item !== slot) : [...current, slot].sort()));
	}

	const eligiblePostponeDates = useMemo(() => getSchedulePostponableDates(selectedGroup?.schedule), [selectedGroup]);
	const calendarMonthKeys = useMemo(() => [...new Set(eligiblePostponeDates.map((item) => monthKey(item.date)))], [eligiblePostponeDates]);
	const currentMonthKey = calendarMonthKeys[calendarMonthIndex] || '';
	const visibleMonthDates = useMemo(
		() => eligiblePostponeDates.filter((item) => monthKey(item.date) === currentMonthKey),
		[eligiblePostponeDates, currentMonthKey]
	);

	useEffect(() => {
		if (!calendarMonthKeys.length) {
			setCalendarMonthIndex(0);
			setPostponeDate('');
			return;
		}
		const nowKey = monthKey(new Date());
		const nowIndex = calendarMonthKeys.indexOf(nowKey);
		setCalendarMonthIndex(nowIndex >= 0 ? nowIndex : 0);

		const today = toIsoDate(new Date());
		const firstEligible = eligiblePostponeDates[0]?.iso || '';
		const todayEligible = eligiblePostponeDates.some((item) => item.iso === today);
		setPostponeDate(todayEligible ? today : firstEligible);
	}, [selectedScheduleId]);

	function lessonState(studentId, lessonNumber) {
		return localAttendanceMap[`${studentId}_${lessonNumber}`];
	}

	function nextAttendanceState(currentState) {
		if (currentState === true) return false;
		if (currentState === false) return null;
		return true;
	}

	function renderPostponeCalendar() {
		if (!currentMonthKey) {
			return <EmptyState title="Takvim yok" description="Bu ders grubu icin secilebilir tarih bulunmuyor." />;
		}

		const [year, month] = currentMonthKey.split('-').map(Number);
		const firstDay = new Date(year, month - 1, 1);
		const daysInMonth = new Date(year, month, 0).getDate();
		const leadingBlankCount = (firstDay.getDay() + 6) % 7;
		const dateMap = new Map(visibleMonthDates.map((item) => [item.iso, item]));
		const cells = [];

		for (let index = 0; index < leadingBlankCount; index += 1) {
			cells.push(<View key={`blank-${index}`} style={styles.calendarBlank} />);
		}

		for (let day = 1; day <= daysInMonth; day += 1) {
			const iso = toIsoDate(new Date(year, month - 1, day));
			const item = dateMap.get(iso);
			if (!item) {
				cells.push(
					<View key={iso} style={styles.calendarCell}>
						<View style={styles.calendarDisabled}>
							<Text style={styles.calendarDisabledText}>{day}</Text>
						</View>
					</View>
				);
				continue;
			}

			const selected = postponeDate === iso;
			cells.push(
				<View key={iso} style={styles.calendarCell}>
					<Pressable
						onPress={() => setPostponeDate(iso)}
						style={({ pressed }) => [
							styles.calendarButton,
							selected && styles.calendarButtonSelected,
							pressed && styles.pressed,
						]}
					>
						<Text style={[styles.calendarButtonDay, selected && styles.calendarButtonDaySelected]}>{day}</Text>
						<Text style={[styles.calendarButtonWeekday, selected && styles.calendarButtonDaySelected]}>{item.dayLabel}</Text>
					</Pressable>
				</View>
			);
		}

		return <View style={styles.calendarGrid}>{cells}</View>;
	}

	return (
		<ScreenLayout title="Ders Akislari" subtitle="Yoklama, erteleme ve yorum bolumleri artik daha sade sekilde ayrildi.">
			<SectionHeader title="Ders gruplari" caption="Aktif grubu sec, panel karisimi yerine tek bolumde calis" />
			<View style={styles.card}>
				<View style={styles.chipRow}>
					{data.groupedSchedules.map((group) => (
						<ActionButton
							key={group.schedule.id}
							label={`${group.branch?.name || 'Sube'} | ${group.schedule.time || '-'}`}
							variant={selectedScheduleId === group.schedule.id ? 'primary' : 'secondary'}
							onPress={() => setSelectedScheduleId(group.schedule.id)}
						/>
					))}
				</View>
				{!selectedGroup ? (
					<EmptyState title="Ders bulunamadi" description="Antrenore bagli schedule kaydi yok." />
				) : (
					<View style={styles.subCard}>
						<Text style={styles.itemTitle}>{selectedGroup.branch?.name || 'Bilinmiyor'} | {selectedGroup.schedule.time || '-'}</Text>
						<Text style={styles.itemText}>{selectedGroup.schedule.days?.join(', ') || '-'} | {selectedGroup.schedule.capacity || 0} kisi</Text>
						<Text style={styles.itemText}>{selectedGroup.students.length} ogrenci | {selectedGroup.schedule.lessonsCount || 1} ders</Text>
					</View>
				)}
			</View>

			<SectionHeader title="Calisma paneli" caption="Ihtiyacin olan bolumu sec" />
			<View style={styles.card}>
				<View style={styles.chipRow}>
					{panelOptions.map((panel) => (
						<ActionButton key={panel.key} label={panel.label} variant={panelKey === panel.key ? 'primary' : 'secondary'} onPress={() => setPanelKey(panel.key)} />
					))}
				</View>
			</View>


			{panelKey === 'attendance' ? (
				<>
					<SectionHeader title="Yoklama" caption="Butona tikladigin anda renk degisir" />
					<View style={styles.card}>
						{!selectedStudents.length ? (
							<EmptyState title="Ogrenci yok" description="Secili ders grubunda ogrenci bulunmuyor." />
						) : (
							selectedStudents.map((student) => (
								<View key={student.id} style={styles.studentCard}>
									<Text style={styles.itemTitle}>{student.name} {student.surname || ''}</Text>
									<View style={styles.lessonGrid}>
										{Array.from({ length: Math.max(1, Number(selectedGroup?.schedule?.lessonsCount || 1)) }, (_, index) => {
											const lessonNumber = index + 1;
											const currentState = lessonState(student.id, lessonNumber);
											const appearance = lessonColors(currentState);
											const nextState = nextAttendanceState(currentState);
											return (
												<Pressable
													key={`${student.id}-${lessonNumber}`}
													onPress={() => attendanceMutation.mutate({ studentId: student.id, lessonNumber, nextState })}
													style={({ pressed }) => [styles.lessonButton, { backgroundColor: appearance.backgroundColor, borderColor: appearance.borderColor }, pressed && styles.pressed]}
												>
													<Text style={[styles.lessonLabel, { color: appearance.color }]}>D{lessonNumber}</Text>
													<Text style={[styles.lessonMark, { color: appearance.color }]}>{appearance.label}</Text>
												</Pressable>
											);
										})}
									</View>
								</View>
							))
						)}
					</View>
				</>
			) : null}

			{panelKey === 'postpone' ? (
				<>
					<SectionHeader title="Ders erteleme" caption="Sadece ders gunleri secilebilir" />
					<View style={styles.cardAccent}>
						{!selectedGroup ? (
							<EmptyState title="Ders secilmedi" description="Erteleme icin once bir ders grubu secin." />
						) : (
							<>
								<Text style={styles.itemTitle}>{selectedGroup.branch?.name || 'Sube'} | {selectedGroup.schedule.time || '-'}</Text>
								<Text style={styles.itemText}>Mevcut erteleme: {selectedGroup.schedule.postponementCount || 0}</Text>
								<View style={styles.calendarHeader}>
									<ActionButton label="<" variant="secondary" onPress={() => setCalendarMonthIndex((index) => {
										if (!calendarMonthKeys.length) return 0;
										return Math.max(0, index - 1);
									})} />
									<Text style={styles.calendarMonthLabel}>{monthLabel(currentMonthKey)}</Text>
									<ActionButton label=">" variant="secondary" onPress={() => setCalendarMonthIndex((index) => {
										if (!calendarMonthKeys.length) return 0;
										return Math.min(calendarMonthKeys.length - 1, index + 1);
									})} />
								</View>
								<View style={styles.calendarWeekRow}>
									{['Pzt', 'Sali', 'Cars', 'Pers', 'Cuma', 'Cmt', 'Pzr'].map((label) => (
										<Text key={label} style={styles.calendarWeekLabel}>{label}</Text>
									))}
								</View>
								{renderPostponeCalendar()}
								<Text style={styles.itemText}>Secili tarih: {postponeDate || '-'}</Text>
								<TextInput style={[styles.input, styles.textarea]} multiline placeholder="Erteleme nedeni" value={postponeReason} onChangeText={setPostponeReason} />
								<ActionButton label={postponeMutation.isPending ? 'Kaydediliyor...' : 'Dersi Ertele'} onPress={() => postponeMutation.mutate()} fullWidth />
							</>
						)}
					</View>
				</>
			) : null}

			{panelKey === 'comment' ? (
				<>
					<SectionHeader title="Ders yorumu" caption="Yorum veli paneline yansir" />
					<View style={styles.card}>
						<View style={styles.chipRow}>
							{selectedStudents.map((student) => (
								<ActionButton key={student.id} label={`${student.name} ${student.surname || ''}`} variant={selectedStudentId === student.id ? 'primary' : 'secondary'} onPress={() => setSelectedStudentId(student.id)} />
							))}
						</View>
						<TextInput style={styles.input} placeholder="Konu" value={commentTopic} onChangeText={setCommentTopic} />
						<TextInput style={styles.input} placeholder="Tarih (YYYY-MM-DD)" value={commentDate} onChangeText={setCommentDate} />
						<TextInput style={[styles.input, styles.textarea]} multiline placeholder="Yorum" value={commentText} onChangeText={setCommentText} />
						<ActionButton label={commentMutation.isPending ? 'Kaydediliyor...' : 'Yorumu Kaydet'} onPress={() => commentMutation.mutate()} fullWidth />
						{data.recentComments.length ? data.recentComments.map((comment) => (
							<View key={comment.id} style={styles.subCard}>
								<Text style={styles.itemTitle}>{comment.studentName || 'Ogrenci'} | {comment.topic}</Text>
								<Text style={styles.itemText}>{comment.lessonDate || '-'}</Text>
								<Text style={styles.itemText}>{comment.comment}</Text>
							</View>
						)) : null}
					</View>
				</>
			) : null}

			{panelKey === 'availability' ? (
				<>
					<SectionHeader title="Musaitlik planlayici" caption="Admin tarafinda tanimli saat havuzundan secim yap" />
					<View style={styles.card}>
						<Text style={styles.label}>Sube</Text>
						<View style={styles.chipRow}>
							{data.branches.map((branch) => (
								<ActionButton key={branch.id} label={branch.name} variant={selectedBranchId === branch.id ? 'primary' : 'secondary'} onPress={() => setSelectedBranchId(branch.id)} />
							))}
						</View>
						<Text style={styles.label}>Gun</Text>
						<View style={styles.chipRow}>
							{dayOptions.map((day) => (
								<ActionButton key={day.key} label={day.label} variant={selectedDay === day.key ? 'primary' : 'secondary'} onPress={() => setSelectedDay(day.key)} />
							))}
						</View>
						<Text style={styles.label}>Saatler</Text>
						{!availableSlots.length ? (
							<EmptyState title="Saat havuzu yok" description="Bu sube ve gun icin admin tarafinda saat tanimlanmamis." />
						) : (
							<View style={styles.chipRow}>
								{availableSlots.map((slot) => (
									<ActionButton key={slot} label={slot} variant={selectedSlots.includes(slot) ? 'primary' : 'secondary'} onPress={() => toggleSlot(slot)} />
								))}
							</View>
						)}
						<ActionButton label={availabilityMutation.isPending ? 'Kaydediliyor...' : 'Musaitligi Kaydet'} onPress={() => availabilityMutation.mutate()} fullWidth />
						{data.availabilitySummary.length ? data.availabilitySummary.map((item) => (
							<View key={item.id} style={styles.subCard}>
								<Text style={styles.itemTitle}>{item.branchName}</Text>
								<Text style={styles.itemText}>{item.daySummary || 'Kayitli saat yok'}</Text>
							</View>
						)) : null}
					</View>
				</>
			) : null}

			{panelKey === 'completion' ? (
				<>
					<SectionHeader title="Bitis takvimi" caption="Ozellikle ozel ders kalanlari takip et" />
					<View style={styles.card}>
						{!data.completionRows.length ? (
							<EmptyState title="Takvim kaydi yok" description="Bitis tarihi hesaplanabilen ogrenci bulunmuyor." />
						) : (
							data.completionRows.map((item) => (
								<View key={item.studentId} style={styles.subCard}>
									<Text style={styles.itemTitle}>{item.studentName}</Text>
									<Text style={styles.itemText}>{item.branchName} | {item.scheduleName}</Text>
									<Text style={styles.itemText}>Bitis: {item.endDate}</Text>
									<Text style={[styles.itemText, item.daysLeft < 0 ? styles.danger : styles.warning]}>
										{item.daysLeft < 0 ? `${Math.abs(item.daysLeft)} gun gecti` : item.daysLeft === 0 ? 'Bugun bitiyor' : `${item.daysLeft} gun kaldi`}
									</Text>
									{item.isPrivateLesson ? <Text style={styles.itemText}>Kalan ders: {item.remainingLessons}</Text> : null}
								</View>
							))
						)}
					</View>
				</>
			) : null}
		</ScreenLayout>
	);
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: theme.colors.surface,
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.md,
		padding: theme.spacing.md,
		gap: 10,
	},
	cardAccent: {
		backgroundColor: '#fff6e9',
		borderWidth: 1,
		borderColor: '#f4d6a1',
		borderRadius: theme.radius.md,
		padding: theme.spacing.md,
		gap: 10,
	},
	subCard: {
		backgroundColor: '#fbfdff',
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.md,
		padding: theme.spacing.md,
		gap: 4,
	},
	studentCard: {
		backgroundColor: '#fbfdff',
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.md,
		padding: theme.spacing.md,
		gap: 10,
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
	itemTitle: {
		color: theme.colors.text,
		fontWeight: '800',
		fontSize: 15,
	},
	itemText: {
		color: theme.colors.textMuted,
	},
	input: {
		minHeight: 48,
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: 14,
		paddingHorizontal: 14,
		color: theme.colors.text,
	},
	textarea: {
		minHeight: 96,
		paddingVertical: 12,
		textAlignVertical: 'top',
	},
	lessonGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	lessonButton: {
		minWidth: 62,
		borderWidth: 1,
		borderRadius: 14,
		paddingVertical: 10,
		paddingHorizontal: 8,
		alignItems: 'center',
		gap: 2,
	},
	lessonLabel: {
		fontWeight: '700',
		fontSize: 12,
	},
	lessonMark: {
		fontWeight: '800',
		fontSize: 16,
	},
	warning: {
		color: theme.colors.warning,
	},
	danger: {
		color: theme.colors.danger,
	},
	pressed: {
		opacity: 0.85,
	},
	calendarHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 8,
	},
	calendarMonthLabel: {
		flex: 1,
		textAlign: 'center',
		fontWeight: '800',
		color: theme.colors.text,
	},
	calendarWeekRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingHorizontal: 4,
	},
	calendarWeekLabel: {
		width: '14.2%',
		textAlign: 'center',
		fontSize: 11,
		fontWeight: '700',
		color: theme.colors.textMuted,
	},
	calendarGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 6,
	},
	calendarCell: {
		width: '13.5%',
	},
	calendarBlank: {
		width: '13.5%',
		height: 42,
	},
	calendarButton: {
		minHeight: 42,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: '#d8e4f0',
		backgroundColor: '#fffdf8',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 4,
	},
	calendarButtonSelected: {
		backgroundColor: theme.colors.primary,
		borderColor: theme.colors.primary,
	},
	calendarButtonDay: {
		fontWeight: '800',
		color: theme.colors.text,
		fontSize: 12,
	},
	calendarButtonDaySelected: {
		color: '#ffffff',
	},
	calendarButtonWeekday: {
		fontSize: 9,
		color: theme.colors.textMuted,
	},
	calendarDisabled: {
		minHeight: 42,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: '#f1e5d0',
		backgroundColor: '#f8efe2',
		alignItems: 'center',
		justifyContent: 'center',
	},
	calendarDisabledText: {
		fontSize: 11,
		color: '#c6aa7c',
	},
});