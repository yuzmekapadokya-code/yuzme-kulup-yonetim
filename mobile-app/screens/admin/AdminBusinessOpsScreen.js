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
import { getAdminScope } from '../../services/roleService';
import { deleteDiscount, deleteExpense, deleteIncome, getAdminFinanceOverview, saveDiscount, saveExpense, saveIncome } from '../../services/adminService';
import { useAuthStore } from '../../store/authStore';
import { formatDate } from '../../utils/date';

const rangeOptions = [
  { key: 'week', label: '7 Gun' },
  { key: 'twoWeeks', label: '14 Gun' },
  { key: 'month', label: '1 Ay' },
  { key: 'twoMonths', label: '2 Ay' },
  { key: 'threeMonths', label: '3 Ay' },
  { key: 'year', label: '1 Yil' },
  { key: 'all', label: 'Tum Zaman' },
];

function initialFinanceForm() {
  return { description: '', amount: '', date: '', branchId: '', scheduleId: '' };
}

function initialDiscountForm() {
  return { code: '', percentage: '', expiryDate: '', usageLimit: '' };
}

function formatCurrency(value) {
  return `₺${Number(value || 0).toFixed(2)}`;
}

export default function AdminBusinessOpsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const adminScope = getAdminScope(profile);
  const queryClient = useQueryClient();
  const [rangePreset, setRangePreset] = useState('all');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [incomeValues, setIncomeValues] = useState(initialFinanceForm());
  const [expenseValues, setExpenseValues] = useState(initialFinanceForm());
  const [discountValues, setDiscountValues] = useState(initialDiscountForm());

  const financeQuery = useQuery({
    queryKey: ['ad-finance', adminScope, rangePreset, selectedBranchId, selectedScheduleId],
    queryFn: () => getAdminFinanceOverview(adminScope, { rangePreset, branchId: selectedBranchId, scheduleId: selectedScheduleId }),
    enabled: Boolean(adminScope),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['ad-finance', adminScope] });
    queryClient.invalidateQueries({ queryKey: ['ad-dashboard', adminScope] });
  }

  const incomeMutation = useMutation({
    mutationFn: () => saveIncome({ adminId: adminScope, values: incomeValues, currentAdminId: profile?.uid || adminScope }),
    onSuccess: () => {
      setIncomeValues(initialFinanceForm());
      invalidate();
    },
    onError: (error) => Alert.alert('Gelir', error.message || 'Gelir kaydedilemedi.'),
  });

  const expenseMutation = useMutation({
    mutationFn: () => saveExpense({ adminId: adminScope, values: expenseValues, currentAdminId: profile?.uid || adminScope }),
    onSuccess: () => {
      setExpenseValues(initialFinanceForm());
      invalidate();
    },
    onError: (error) => Alert.alert('Gider', error.message || 'Gider kaydedilemedi.'),
  });

  const discountMutation = useMutation({
    mutationFn: () => saveDiscount({ adminId: adminScope, values: discountValues, currentAdminId: profile?.uid || adminScope }),
    onSuccess: () => {
      setDiscountValues(initialDiscountForm());
      invalidate();
    },
    onError: (error) => Alert.alert('Indirim Kodu', error.message || 'Indirim kodu kaydedilemedi.'),
  });

  const deleteIncomeMutation = useMutation({ mutationFn: deleteIncome, onSuccess: invalidate });
  const deleteExpenseMutation = useMutation({ mutationFn: deleteExpense, onSuccess: invalidate });
  const deleteDiscountMutation = useMutation({ mutationFn: deleteDiscount, onSuccess: invalidate });

  if (financeQuery.isLoading) {
    return <LoadingBlock label="Finans modulu yukleniyor..." />;
  }

  if (financeQuery.isError) {
    return (
      <ScreenLayout title="Finans" subtitle="Finans verisi alinirken hata olustu.">
        <EmptyState title="Finans acilamadi" description={financeQuery.error?.message || 'Gelir-gider verisi okunurken hata olustu.'} />
        <ActionButton label="Tekrar Dene" onPress={() => financeQuery.refetch()} fullWidth />
      </ScreenLayout>
    );
  }

  const data = financeQuery.data;
  const schedulesForSelectedBranch = data.schedules.filter((schedule) => !selectedBranchId || schedule.branchId === selectedBranchId);

  return (
    <ScreenLayout title="Finans" subtitle="Web panelindeki gelir-gider mantigi ile ayni veri modelini kullanan finans ve kampanya ekrani.">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stack}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>FINANS MERKEZI</Text>
          <Text style={styles.heroTitle}>Gelir ve gideri temiz gor</Text>
          <Text style={styles.heroText}>Bu modul web panelindeki gelir-gider hesaplama yapisi ile ayni kayitlar uzerinden calisir ve anlik guncellenir.</Text>
        </View>

        <SectionHeader title="Donem filtresi" caption="Web ekranina benzer zaman araligini sec" />
        <View style={styles.card}>
          <View style={styles.chipRow}>
            {rangeOptions.map((option) => (
              <ActionButton key={option.key} label={option.label} variant={rangePreset === option.key ? 'primary' : 'secondary'} onPress={() => setRangePreset(option.key)} />
            ))}
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Ciro" value={formatCurrency(data.summary.turnover)} tone="primary" />
          <StatCard label="Gelir" value={formatCurrency(data.summary.income)} tone="success" />
          <StatCard label="Gider" value={formatCurrency(data.summary.expense)} tone="primary" />
          <StatCard label="Kar" value={formatCurrency(data.summary.profit)} tone="success" />
        </View>

        <SectionHeader title="Sube ve saat filtresi" caption="Gelir-gideri ayni web ekranindaki gibi kir" />
        <View style={styles.card}>
          <Text style={styles.label}>Sube</Text>
          <View style={styles.chipRow}>
            <ActionButton label="Tum Subeler" variant={!selectedBranchId ? 'primary' : 'secondary'} onPress={() => { setSelectedBranchId(''); setSelectedScheduleId(''); }} />
            {data.branches.map((branch) => (
              <ActionButton key={branch.id} label={branch.name} variant={selectedBranchId === branch.id ? 'primary' : 'secondary'} onPress={() => { setSelectedBranchId(branch.id); setSelectedScheduleId(''); }} />
            ))}
          </View>
          <Text style={styles.label}>Saat</Text>
          <View style={styles.chipRow}>
            <ActionButton label="Tum Saatler" variant={!selectedScheduleId ? 'primary' : 'secondary'} onPress={() => setSelectedScheduleId('')} />
            {schedulesForSelectedBranch.map((schedule) => (
              <ActionButton key={schedule.id} label={schedule.time} variant={selectedScheduleId === schedule.id ? 'primary' : 'secondary'} onPress={() => setSelectedScheduleId(schedule.id)} />
            ))}
          </View>
        </View>

        <SectionHeader title="Gelir ve gider kaydi" caption="Kayitlari sube ve saat ile bagla" />
        <View style={styles.card}>
          <View style={styles.formBlock}>
            <Text style={styles.blockTitle}>➕ Ek Gelir</Text>
            <TextInput style={styles.input} placeholder="Aciklama" value={incomeValues.description} onChangeText={(text) => setIncomeValues((current) => ({ ...current, description: text }))} />
            <TextInput style={styles.input} placeholder="Tutar" keyboardType="numeric" value={incomeValues.amount} onChangeText={(text) => setIncomeValues((current) => ({ ...current, amount: text }))} />
            <TextInput style={styles.input} placeholder="Tarih (YYYY-MM-DD)" value={incomeValues.date} onChangeText={(text) => setIncomeValues((current) => ({ ...current, date: text }))} />
            <View style={styles.chipRow}>
              {data.branches.map((branch) => (
                <ActionButton key={`income-${branch.id}`} label={branch.name} variant={incomeValues.branchId === branch.id ? 'primary' : 'secondary'} onPress={() => setIncomeValues((current) => ({ ...current, branchId: branch.id, scheduleId: '' }))} />
              ))}
            </View>
            <View style={styles.chipRow}>
              {data.schedules.filter((schedule) => !incomeValues.branchId || schedule.branchId === incomeValues.branchId).map((schedule) => (
                <ActionButton key={`income-sch-${schedule.id}`} label={schedule.time} variant={incomeValues.scheduleId === schedule.id ? 'primary' : 'secondary'} onPress={() => setIncomeValues((current) => ({ ...current, scheduleId: schedule.id }))} />
              ))}
            </View>
            <ActionButton label={incomeMutation.isPending ? 'Kaydediliyor...' : 'Gelir Kaydet'} onPress={() => incomeMutation.mutate()} fullWidth />
          </View>

          <View style={styles.formBlockSecondary}>
            <Text style={styles.blockTitle}>➖ Gider</Text>
            <TextInput style={styles.input} placeholder="Aciklama" value={expenseValues.description} onChangeText={(text) => setExpenseValues((current) => ({ ...current, description: text }))} />
            <TextInput style={styles.input} placeholder="Tutar" keyboardType="numeric" value={expenseValues.amount} onChangeText={(text) => setExpenseValues((current) => ({ ...current, amount: text }))} />
            <TextInput style={styles.input} placeholder="Tarih (YYYY-MM-DD)" value={expenseValues.date} onChangeText={(text) => setExpenseValues((current) => ({ ...current, date: text }))} />
            <View style={styles.chipRow}>
              {data.branches.map((branch) => (
                <ActionButton key={`expense-${branch.id}`} label={branch.name} variant={expenseValues.branchId === branch.id ? 'primary' : 'secondary'} onPress={() => setExpenseValues((current) => ({ ...current, branchId: branch.id, scheduleId: '' }))} />
              ))}
            </View>
            <View style={styles.chipRow}>
              {data.schedules.filter((schedule) => !expenseValues.branchId || schedule.branchId === expenseValues.branchId).map((schedule) => (
                <ActionButton key={`expense-sch-${schedule.id}`} label={schedule.time} variant={expenseValues.scheduleId === schedule.id ? 'primary' : 'secondary'} onPress={() => setExpenseValues((current) => ({ ...current, scheduleId: schedule.id }))} />
              ))}
            </View>
            <ActionButton label={expenseMutation.isPending ? 'Kaydediliyor...' : 'Gider Kaydet'} onPress={() => expenseMutation.mutate()} fullWidth />
          </View>
        </View>

        <SectionHeader title="Sube bazli ozet" caption="Web tablosundaki sube bazli toplamlari oku" />
        <View style={styles.stack}>
          {!data.branchCards.length ? (
            <EmptyState title="Finans kaydi yok" description="Secili filtre icin finans verisi bulunmuyor." />
          ) : (
            data.branchCards.map((branch) => (
              <View key={branch.branchId} style={styles.branchCard}>
                <Text style={styles.branchTitle}>🏢 {branch.branchName}</Text>
                <Text style={styles.branchMeta}>Ciro {formatCurrency(branch.totalTurnover)} | Gelir {formatCurrency(branch.totalIncome)} | Gider {formatCurrency(branch.totalExpense)} | Kar {formatCurrency(branch.totalProfit)}</Text>
                <View style={styles.branchScheduleList}>
                  {Object.values(branch.schedules).map((schedule) => (
                    <View key={schedule.scheduleId} style={styles.scheduleCard}>
                      <Text style={styles.itemTitle}>⏰ {schedule.scheduleName}</Text>
                      <Text style={styles.itemText}>Ciro: {formatCurrency(schedule.turnover)}</Text>
                      <Text style={styles.itemText}>Gelir: {formatCurrency(schedule.income)}</Text>
                      <Text style={styles.itemText}>Gider: {formatCurrency(schedule.expense)}</Text>
                      <Text style={styles.itemText}>Manuel: {formatCurrency(schedule.manualExpense)} | Maas: {formatCurrency(schedule.salaryExpense)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
        </View>

        <SectionHeader title="Son finans hareketleri" caption="Yeni gelir ve giderleri hizli gor" />
        <View style={styles.card}>
          <Text style={styles.blockTitle}>Gelirler</Text>
          {!data.recentIncomes.length ? <EmptyState title="Gelir yok" description="Ek gelir kaydi bulunmuyor." /> : data.recentIncomes.map((income) => (
            <View key={income.id} style={styles.inlineCard}>
              <View style={styles.inlineBody}>
                <Text style={styles.itemTitle}>{income.description || 'Gelir'}</Text>
                <Text style={styles.itemText}>{formatCurrency(income.amount)} | {formatDate(income.date || income.createdAt)}</Text>
              </View>
              <ActionButton label="Sil" variant="secondary" onPress={() => deleteIncomeMutation.mutate(income.id)} />
            </View>
          ))}
          <Text style={styles.blockTitle}>Giderler</Text>
          {!data.recentExpenses.length ? <EmptyState title="Gider yok" description="Gider kaydi bulunmuyor." /> : data.recentExpenses.map((expense) => (
            <View key={expense.id} style={styles.inlineCard}>
              <View style={styles.inlineBody}>
                <Text style={styles.itemTitle}>{expense.description || 'Gider'}</Text>
                <Text style={styles.itemText}>{formatCurrency(expense.amount)} | {formatDate(expense.date || expense.createdAt)}</Text>
              </View>
              <ActionButton label="Sil" variant="secondary" onPress={() => deleteExpenseMutation.mutate(expense.id)} />
            </View>
          ))}
        </View>

        <SectionHeader title="Indirim kodlari" caption="Finans basligi altinda kampanya kodlarini yonet" />
        <View style={styles.formBlockAccent}>
          <Text style={styles.blockTitle}>🏷️ Kampanya kodu</Text>
          <TextInput style={styles.input} placeholder="Kod" autoCapitalize="characters" value={discountValues.code} onChangeText={(text) => setDiscountValues((current) => ({ ...current, code: text }))} />
          <TextInput style={styles.input} placeholder="Yuzde" keyboardType="numeric" value={discountValues.percentage} onChangeText={(text) => setDiscountValues((current) => ({ ...current, percentage: text }))} />
          <TextInput style={styles.input} placeholder="Son tarih (YYYY-MM-DD)" value={discountValues.expiryDate} onChangeText={(text) => setDiscountValues((current) => ({ ...current, expiryDate: text }))} />
          <TextInput style={styles.input} placeholder="Kullanim limiti" keyboardType="numeric" value={discountValues.usageLimit} onChangeText={(text) => setDiscountValues((current) => ({ ...current, usageLimit: text }))} />
          <ActionButton label={discountMutation.isPending ? 'Kaydediliyor...' : 'Indirim Kodu Olustur'} onPress={() => discountMutation.mutate()} fullWidth />
          {!data.discounts.length ? <EmptyState title="Indirim kodu yok" description="Henuz kampanya kodu bulunmuyor." /> : data.discounts.map((discount) => (
            <View key={discount.id} style={styles.inlineCard}>
              <View style={styles.inlineBody}>
                <Text style={styles.itemTitle}>🏷️ {discount.code}</Text>
                <Text style={styles.itemText}>%{discount.percentage} | Son tarih: {discount.expiryDate || '-'}</Text>
                <Text style={styles.itemText}>Kullanim: {discount.usageCount || 0}{discount.usageLimit ? ` / ${discount.usageLimit}` : ''}</Text>
              </View>
              <ActionButton label="Sil" variant="secondary" onPress={() => deleteDiscountMutation.mutate(discount.id)} />
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
    backgroundColor: '#eaf7ef',
    borderColor: '#cfead8',
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 8,
  },
  heroEyebrow: {
    color: '#196b4f',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#14543f',
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
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 12,
  },
  formBlock: {
    backgroundColor: '#f4fbff',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#d4eaf8',
    padding: theme.spacing.md,
    gap: 10,
  },
  formBlockSecondary: {
    backgroundColor: '#fff8ef',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#f4dfb8',
    padding: theme.spacing.md,
    gap: 10,
  },
  formBlockAccent: {
    backgroundColor: '#fff4df',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#f0d39a',
    padding: theme.spacing.md,
    gap: 10,
  },
  blockTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 16,
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
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: theme.colors.text,
    backgroundColor: '#ffffff',
  },
  branchCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 10,
  },
  branchTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  branchMeta: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  branchScheduleList: {
    gap: 10,
  },
  scheduleCard: {
    backgroundColor: '#fbfdff',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
  },
  inlineCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: '#fbfdff',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  inlineBody: {
    flex: 1,
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