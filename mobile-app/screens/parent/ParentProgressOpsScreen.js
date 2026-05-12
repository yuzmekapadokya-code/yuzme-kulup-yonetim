import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import StatCard from '../../components/StatCard';
import { theme } from '../../config/theme';
import { getParentProgressData, getParentReviewQuestions, saveParentTrainerReview } from '../../services/parentService';
import { useAuthStore } from '../../store/authStore';
import { formatDate } from '../../utils/date';

function buildEmptyScores() {
  return getParentReviewQuestions().reduce((result, question) => {
    result[question.key] = 0;
    return result;
  }, {});
}

export default function ParentProgressOpsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const [expandedGroupKey, setExpandedGroupKey] = useState('');
  const [reviewDraft, setReviewDraft] = useState(null);
  const [questionScores, setQuestionScores] = useState(buildEmptyScores());
  const [reviewComment, setReviewComment] = useState('');

  const progressQuery = useQuery({
    queryKey: ['pr-progress', profile?.uid],
    queryFn: () => getParentProgressData(profile),
    enabled: Boolean(profile?.uid),
  });

  useEffect(() => {
    if (!reviewDraft) return;
    setQuestionScores(reviewDraft.existingQuestionScores || buildEmptyScores());
    setReviewComment(reviewDraft.existingComment || '');
  }, [reviewDraft]);

  const reviewMutation = useMutation({
    mutationFn: () => saveParentTrainerReview({
      profile,
      values: {
        ...reviewDraft,
        questionScores,
        comment: reviewComment,
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pr-progress', profile.uid] });
      queryClient.invalidateQueries({ queryKey: ['pr-dashboard', profile.uid] });
      setReviewDraft(null);
      setQuestionScores(buildEmptyScores());
      setReviewComment('');
    },
    onError: (error) => Alert.alert('Degerlendirme', error.message || 'Degerlendirme kaydedilemedi.'),
  });

  if (progressQuery.isLoading) {
    return <LoadingBlock label="Performans modulu yukleniyor..." />;
  }

  const data = progressQuery.data;
  const questions = getParentReviewQuestions();

  return (
    <ScreenLayout title="Performans ve Baraj" subtitle="Dereceler, antrenor notlari, veli degerlendirmeleri ve baraj eslesmeleri tek ekranda.">
      <View style={styles.statsGrid}>
        {data.stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </View>

      <SectionHeader title="Genel antrenor degerlendirmeleri" caption="Atanmis antrenorler icin genel memnuniyet" />
      <View style={styles.stack}>
        {!data.reviews.generalReviews.length ? (
          <EmptyState title="Antrenor bulunamadi" description="Bu ogrenci icin atanmis antrenor kaydi yok." />
        ) : (
          data.reviews.generalReviews.map((review) => (
            <View key={review.trainerKey} style={styles.card}>
              <Text style={styles.cardTitle}>{review.trainerName}</Text>
              <Text style={styles.cardText}>{review.hasReview ? `Genel puaniniz: ${review.averageLabel} • ${review.stars}` : 'Henuz genel degerlendirme yapilmadi.'}</Text>
              <Text style={styles.cardText}>Ders bazli degerlendirme sayisi: {review.lessonReviewCount}</Text>
              <ActionButton
                label={review.hasReview ? 'Genel Degerlendirmeyi Guncelle' : 'Genel Degerlendirme Yap'}
                onPress={() => setReviewDraft({
                  reviewId: review.reviewId,
                  existingQuestionScores: review.existingQuestionScores,
                  existingComment: review.existingComment,
                  scopeType: 'general',
                  targetId: review.trainerKey,
                  scopeKey: `general_${review.trainerKey}`,
                  trainerId: review.trainerId,
                  trainerDocId: review.trainerDocId,
                  trainerName: review.trainerName,
                })}
              />
            </View>
          ))
        )}
      </View>

      <SectionHeader title="Performans kartlari" caption="En iyi sureler ve baraj durumu" />
      <View style={styles.stack}>
        {!data.performances.length ? (
          <EmptyState title="Performans yok" description="Henuz performans kaydi bulunmuyor." />
        ) : (
          data.performances.map((performance) => (
            <View key={performance.key} style={styles.card}>
              <Text style={styles.cardTitle}>{performance.distance}m {performance.styleLabel}</Text>
              <Text style={styles.bestValue}>{performance.bestTime}</Text>
              <Text style={styles.cardText}>Son derece: {performance.latestTime} | {formatDate(performance.latestDate)}</Text>
              {performance.status ? (
                <Text style={[styles.cardText, performance.status.passed ? styles.success : styles.warning]}>
                  {performance.status.title} | {performance.status.passed ? `${performance.status.deltaLabel} farkla gecti` : `${performance.status.deltaLabel} geride`}
                </Text>
              ) : (
                <Text style={styles.cardText}>Baraj eslesmesi yok.</Text>
              )}
              {performance.history.map((item) => (
                <View key={item.id} style={styles.subRow}>
                  <Text style={styles.cardText}>{item.time}</Text>
                  <Text style={styles.cardText}>{formatDate(item.date || item.createdAt)}</Text>
                </View>
              ))}
            </View>
          ))
        )}
      </View>

      <SectionHeader title="Antrenor notlari" caption="Ders bazli yorumlar ve veli geri bildirimi" />
      <View style={styles.stack}>
        {!data.reviews.lessonReviews.length ? (
          <EmptyState title="Yorum yok" description="Antrenor notu girilmemis." />
        ) : (
          data.reviews.lessonReviews.map((comment) => (
            <View key={comment.id} style={styles.card}>
              <Text style={styles.cardTitle}>{comment.topic || 'Ders Yorumu'}</Text>
              <Text style={styles.cardText}>{comment.trainerName || 'Antrenor'} | {formatDate(comment.lessonDate || comment.createdAt)}</Text>
              <Text style={styles.cardText}>{comment.comment}</Text>
              <Text style={styles.cardText}>{comment.hasReview ? `Verdiginiz puan: ${comment.averageLabel} • ${comment.stars}` : 'Bu ders icin degerlendirme yapilmadi.'}</Text>
              <ActionButton
                label={comment.hasReview ? 'Degerlendirmeyi Guncelle' : 'Antrenoru Degerlendir'}
                onPress={() => setReviewDraft({
                  reviewId: comment.reviewId,
                  existingQuestionScores: comment.existingQuestionScores,
                  existingComment: comment.existingComment,
                  scopeType: 'lesson',
                  targetId: comment.id,
                  scopeKey: `lesson_${comment.id}`,
                  trainerId: comment.trainerId,
                  trainerDocId: comment.trainerDocId,
                  trainerName: comment.trainerName,
                  lessonCommentId: comment.id,
                  lessonDate: comment.lessonDate || comment.createdAt || '',
                  lessonTopic: comment.topic || 'Ders yorumu',
                })}
              />
            </View>
          ))
        )}
      </View>

      <SectionHeader title="Barajlar" caption="Dogum yili ve stil bazli uygun standartlar" />
      <View style={styles.stack}>
        {!data.standards.length ? (
          <EmptyState title="Baraj yok" description="Ogrenciye uygun baraj kaydi bulunamadi." />
        ) : (
          data.standards.map((group) => {
            const expanded = expandedGroupKey === group.key;
            return (
              <View key={group.key} style={styles.groupCard}>
                <Pressable onPress={() => setExpandedGroupKey(expanded ? '' : group.key)} style={({ pressed }) => [styles.groupHeader, pressed && styles.pressed]}>
                  <View style={styles.groupHeaderText}>
                    <Text style={styles.groupTitle}>{expanded ? '\u25bc' : '\u25b6'} {group.title}</Text>
                    <Text style={styles.groupMeta}>{group.meta} | {group.items.length} baraj</Text>
                  </View>
                  <Text style={styles.groupHint}>{expanded ? 'Detayi gizle' : 'Detayi ac'}</Text>
                </Pressable>
                {expanded ? (
                  <View style={styles.groupItems}>
                    {group.items.map((item) => (
                      <View key={item.id} style={styles.itemCard}>
                        <Text style={styles.itemTitle}>{item.style} {item.distance}m</Text>
                        <Text style={styles.itemText}>{item.birthYear} | {item.gender} | Baraj {item.time}</Text>
                        <Text style={[styles.itemText, item.passed ? styles.success : styles.warning]}>
                          {item.bestPerformance ? `${item.passed ? 'Gecti' : 'Gecemedi'} | En iyi ${item.bestPerformance} | ${item.deltaLabel}` : 'Henuz derece yok'}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      {reviewDraft ? (
        <>
          <SectionHeader title="Degerlendirme formu" caption={`${reviewDraft.trainerName} icin veli puanlamasi`} />
          <View style={styles.card}>
            {questions.map((question) => (
              <View key={question.key} style={styles.questionBlock}>
                <Text style={styles.cardTitle}>{question.label}</Text>
                <View style={styles.optionRow}>
                  {question.options.map((option) => (
                    <ActionButton
                      key={`${question.key}-${option.value}`}
                      label={`${option.value}`}
                      variant={Number(questionScores[question.key]) === option.value ? 'primary' : 'secondary'}
                      onPress={() => setQuestionScores((current) => ({ ...current, [question.key]: option.value }))}
                    />
                  ))}
                </View>
                <Text style={styles.helper}>1: {question.options[0].label} | 5: {question.options[question.options.length - 1].label}</Text>
              </View>
            ))}
            <TextInput style={[styles.input, styles.textarea]} multiline placeholder="Ek yorum" value={reviewComment} onChangeText={setReviewComment} />
            <View style={styles.optionRow}>
              <ActionButton label={reviewMutation.isPending ? 'Kaydediliyor...' : 'Degerlendirmeyi Kaydet'} onPress={() => reviewMutation.mutate()} />
              <ActionButton label="Kapat" variant="secondary" onPress={() => setReviewDraft(null)} />
            </View>
          </View>
        </>
      ) : null}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
    groupCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      marginBottom: 8,
      overflow: 'hidden',
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing.md,
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    groupHeaderText: {
      flexDirection: 'column',
      gap: 2,
    },
    groupTitle: {
      color: theme.colors.text,
      fontWeight: '700',
      fontSize: 16,
    },
    groupMeta: {
      color: theme.colors.textMuted,
      fontSize: 12,
    },
    groupHint: {
      color: theme.colors.info,
      fontSize: 12,
    },
    groupItems: {
      gap: 8,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
    },
    itemCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.sm,
      padding: theme.spacing.sm,
      gap: 4,
    },
    itemTitle: {
      color: theme.colors.text,
      fontWeight: '600',
    },
    itemText: {
      color: theme.colors.textMuted,
      fontSize: 13,
    },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  stack: {
    gap: 12,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 8,
  },
  cardTitle: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  cardText: {
    color: theme.colors.textMuted,
  },
  bestValue: {
    color: theme.colors.success,
    fontSize: 24,
    fontWeight: '800',
  },
  success: {
    color: theme.colors.success,
  },
  warning: {
    color: theme.colors.warning,
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
  },
  subRowBlock: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
    gap: 4,
  },
  questionBlock: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  helper: {
    color: theme.colors.textMuted,
    fontSize: 12,
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
    minHeight: 100,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
});