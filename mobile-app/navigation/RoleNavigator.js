import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { theme } from '../config/theme';
import AdminHomeScreen from '../screens/admin/AdminHomeScreen';
import AdminModulesScreen from '../screens/admin/AdminModulesScreen';
import AdminOrganizationOpsScreen from '../screens/admin/AdminOrganizationOpsScreen';
import AdminScheduleOpsScreen from '../screens/admin/AdminScheduleOpsScreen';
import AdminBusinessOpsScreen from '../screens/admin/AdminBusinessOpsScreen';
import AdminShoppingOpsScreen from '../screens/admin/AdminShoppingOpsScreen';
import AdminContentOpsScreen from '../screens/admin/AdminContentOpsScreen';
import AdminStandardsOpsScreen from '../screens/admin/AdminStandardsOpsScreen';
import ParentHomeScreen from '../screens/parent/ParentHomeScreen';
import ParentCommunicationOpsScreen from '../screens/parent/ParentCommunicationOpsScreen';
import ParentDailyOpsScreen from '../screens/parent/ParentDailyOpsScreen';
import ParentModulesScreen from '../screens/parent/ParentModulesScreen';
import ParentProgressOpsScreen from '../screens/parent/ParentProgressOpsScreen';
import ParentShoppingOpsScreen from '../screens/parent/ParentShoppingOpsScreen';
import SecretaryChatOpsScreen from '../screens/secretary/SecretaryChatOpsScreen';
import SecretaryPreRegistrationOpsScreen from '../screens/secretary/SecretaryPreRegistrationOpsScreen';
import SecretaryHomeScreen from '../screens/secretary/SecretaryHomeScreen';
import SecretaryModulesScreen from '../screens/secretary/SecretaryModulesScreen';
import SecretaryRegistrationOpsScreen from '../screens/secretary/SecretaryRegistrationOpsScreen';
import SecretaryStudentsOpsScreen from '../screens/secretary/SecretaryStudentsOpsScreen';
import FeatureHubScreen from '../screens/shared/FeatureHubScreen';
import ChatDetailScreen from '../screens/shared/ChatDetailScreen';
import ChatListScreen from '../screens/shared/ChatListScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import SuperAdminHomeScreen from '../screens/superadmin/SuperAdminHomeScreen';
import SuperAdminModulesScreen from '../screens/superadmin/SuperAdminModulesScreen';
import SuperAdminAdminOpsScreen from '../screens/superadmin/SuperAdminAdminOpsScreen';
import SuperAdminAdminFormScreen from '../screens/superadmin/SuperAdminAdminFormScreen';
import SuperAdminAdminDetailScreen from '../screens/superadmin/SuperAdminAdminDetailScreen';
import SuperAdminFinanceOpsScreen from '../screens/superadmin/SuperAdminFinanceOpsScreen';
import SuperAdminContentOpsScreen from '../screens/superadmin/SuperAdminContentOpsScreen';
import TrainerHomeScreen from '../screens/trainer/TrainerHomeScreen';
import TrainerModulesScreen from '../screens/trainer/TrainerModulesScreen';
import TrainerClassOpsScreen from '../screens/trainer/TrainerClassOpsScreen';
import TrainerChronometerScreen from '../screens/trainer/TrainerChronometerScreen';
import TrainerPerformanceOpsScreen from '../screens/trainer/TrainerPerformanceOpsScreen';
import TrainerWorkoutOpsScreen from '../screens/trainer/TrainerWorkoutOpsScreen';
import TrainerFinanceOpsScreen from '../screens/trainer/TrainerFinanceOpsScreen';
import TrainerShoppingOpsScreen from '../screens/trainer/TrainerShoppingOpsScreen';
import TrainerStudentsOpsScreen from '../screens/trainer/TrainerStudentsOpsScreen';
import { useAuthStore } from '../store/authStore';
import { sharedStackScreens } from './sharedScreens';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Web tarafindaki .panel-enhanced .header rengiyle birebir hizalanmis ortak stack baslik stili.
const stackScreenOptions = {
  headerStyle: {
    backgroundColor: theme.colors.surface,
  },
  headerTintColor: theme.colors.text,
  headerTitleStyle: {
    fontWeight: '700',
    fontSize: 17,
    color: theme.colors.text,
  },
  headerShadowVisible: false,
  contentStyle: {
    backgroundColor: theme.colors.background,
  },
};

function resolveHomeComponent(role) {
  switch (role) {
    case 'superadmin':
      return SuperAdminHomeScreen;
    case 'admin':
      return AdminHomeScreen;
    case 'secretary':
      return SecretaryHomeScreen;
    case 'trainer':
      return TrainerHomeScreen;
    case 'parent':
      return ParentHomeScreen;
    default:
      return AdminHomeScreen;
  }
}

function HomeStack() {
  const role = useAuthStore((state) => state.profile?.role);
  const HomeComponent = resolveHomeComponent(role);

  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="RoleHome" component={HomeComponent} options={{ headerShown: false }} />
      {sharedStackScreens.map((screen) => (
        <Stack.Screen
          key={screen.name}
          name={screen.name}
          component={screen.component}
          options={{ title: '' }}
        />
      ))}
      {role === 'superadmin' ? (
        <>
          <Stack.Screen name="SAAdminOps" component={SuperAdminAdminOpsScreen} options={{ title: 'Yonetici Operasyonlari' }} />
          <Stack.Screen name="SAAdminForm" component={SuperAdminAdminFormScreen} options={{ title: 'Admin Formu' }} />
          <Stack.Screen name="SAAdminDetail" component={SuperAdminAdminDetailScreen} options={{ title: 'Admin Detayi' }} />
          <Stack.Screen name="SAFinanceOps" component={SuperAdminFinanceOpsScreen} options={{ title: 'Finans Operasyonlari' }} />
          <Stack.Screen name="SAContentOps" component={SuperAdminContentOpsScreen} options={{ title: 'Icerik Operasyonlari' }} />
        </>
      ) : null}
      {role === 'admin' ? (
        <>
          <Stack.Screen name="ADOrganizationOps" component={AdminOrganizationOpsScreen} options={{ title: 'Organizasyon' }} />
          <Stack.Screen name="ADScheduleOps" component={AdminScheduleOpsScreen} options={{ title: 'Programlama' }} />
          <Stack.Screen name="ADShoppingOps" component={AdminShoppingOpsScreen} options={{ title: 'Alisveris' }} />
          <Stack.Screen name="ADBusinessOps" component={AdminBusinessOpsScreen} options={{ title: 'Finans' }} />
          <Stack.Screen name="ADContentOps" component={AdminContentOpsScreen} options={{ title: 'Duyuru ve Takvim' }} />
          <Stack.Screen name="ADStandardsOps" component={AdminStandardsOpsScreen} options={{ title: 'Barajlar' }} />
        </>
      ) : null}
      {role === 'trainer' ? (
        <>
          <Stack.Screen name="TRClassOps" component={TrainerClassOpsScreen} options={{ title: 'Ders Akislari' }} />
          <Stack.Screen name="TRStudentsOps" component={TrainerStudentsOpsScreen} options={{ title: 'Ogrenciler' }} />
          <Stack.Screen name="TRChronometer" component={TrainerChronometerScreen} options={{ title: 'Antrenman Ekrani' }} />
          <Stack.Screen name="TRPerformanceOps" component={TrainerPerformanceOpsScreen} options={{ title: 'Performans' }} />
          <Stack.Screen name="TRWorkoutOps" component={TrainerWorkoutOpsScreen} options={{ title: 'Antrenman ve Market' }} />
          <Stack.Screen name="TRShoppingOps" component={TrainerShoppingOpsScreen} options={{ title: 'Alisveris' }} />
          <Stack.Screen name="TRFinanceOps" component={TrainerFinanceOpsScreen} options={{ title: 'Kredi ve Finans' }} />
        </>
      ) : null}
      {role === 'secretary' ? (
        <>
          <Stack.Screen name="SECRegistrationOps" component={SecretaryRegistrationOpsScreen} options={{ title: 'Ogrenci Kayit' }} />
          <Stack.Screen name="SECStudentsOps" component={SecretaryStudentsOpsScreen} options={{ title: 'Ogrenci ve Odeme' }} />
          <Stack.Screen name="SECChatOps" component={SecretaryChatOpsScreen} options={{ title: 'Sohbet Operasyonlari' }} />
          <Stack.Screen name="SECPreRegistrationOps" component={SecretaryPreRegistrationOpsScreen} options={{ title: 'On Kayit Linki' }} />
        </>
      ) : null}
      {role === 'parent' ? (
        <>
          <Stack.Screen name="PRProgressOps" component={ParentProgressOpsScreen} options={{ title: 'Performans ve Baraj' }} />
          <Stack.Screen name="PRShoppingOps" component={ParentShoppingOpsScreen} options={{ title: 'Alisveris' }} />
          <Stack.Screen name="PRDailyOps" component={ParentDailyOpsScreen} options={{ title: 'Gunluk Yasam' }} />
          <Stack.Screen name="PRCommunicationOps" component={ParentCommunicationOpsScreen} options={{ title: 'Iletisim ve Destek' }} />
        </>
      ) : null}
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} options={{ title: 'Sohbet' }} />
    </Stack.Navigator>
  );
}

function ModulesStack() {
  const role = useAuthStore((state) => state.profile?.role);

  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="FeatureHub" component={role === 'superadmin' ? SuperAdminModulesScreen : role === 'admin' ? AdminModulesScreen : role === 'trainer' ? TrainerModulesScreen : role === 'secretary' ? SecretaryModulesScreen : role === 'parent' ? ParentModulesScreen : FeatureHubScreen} options={{ headerShown: false }} />
      {sharedStackScreens.map((screen) => (
        <Stack.Screen
          key={screen.name}
          name={screen.name}
          component={screen.component}
          options={{ title: '' }}
        />
      ))}
      {role === 'superadmin' ? (
        <>
          <Stack.Screen name="SAAdminOps" component={SuperAdminAdminOpsScreen} options={{ title: 'Yonetici Operasyonlari' }} />
          <Stack.Screen name="SAAdminForm" component={SuperAdminAdminFormScreen} options={{ title: 'Admin Formu' }} />
          <Stack.Screen name="SAAdminDetail" component={SuperAdminAdminDetailScreen} options={{ title: 'Admin Detayi' }} />
          <Stack.Screen name="SAFinanceOps" component={SuperAdminFinanceOpsScreen} options={{ title: 'Finans Operasyonlari' }} />
          <Stack.Screen name="SAContentOps" component={SuperAdminContentOpsScreen} options={{ title: 'Icerik Operasyonlari' }} />
        </>
      ) : null}
      {role === 'admin' ? (
        <>
          <Stack.Screen name="ADOrganizationOps" component={AdminOrganizationOpsScreen} options={{ title: 'Organizasyon' }} />
          <Stack.Screen name="ADScheduleOps" component={AdminScheduleOpsScreen} options={{ title: 'Programlama' }} />
          <Stack.Screen name="ADShoppingOps" component={AdminShoppingOpsScreen} options={{ title: 'Alisveris' }} />
          <Stack.Screen name="ADBusinessOps" component={AdminBusinessOpsScreen} options={{ title: 'Finans' }} />
          <Stack.Screen name="ADContentOps" component={AdminContentOpsScreen} options={{ title: 'Duyuru ve Takvim' }} />
          <Stack.Screen name="ADStandardsOps" component={AdminStandardsOpsScreen} options={{ title: 'Barajlar' }} />
        </>
      ) : null}
      {role === 'trainer' ? (
        <>
          <Stack.Screen name="TRClassOps" component={TrainerClassOpsScreen} options={{ title: 'Ders Akislari' }} />
          <Stack.Screen name="TRStudentsOps" component={TrainerStudentsOpsScreen} options={{ title: 'Ogrenciler' }} />
          <Stack.Screen name="TRChronometer" component={TrainerChronometerScreen} options={{ title: 'Antrenman Ekrani' }} />
          <Stack.Screen name="TRPerformanceOps" component={TrainerPerformanceOpsScreen} options={{ title: 'Performans' }} />
          <Stack.Screen name="TRWorkoutOps" component={TrainerWorkoutOpsScreen} options={{ title: 'Antrenman ve Market' }} />
          <Stack.Screen name="TRShoppingOps" component={TrainerShoppingOpsScreen} options={{ title: 'Alisveris' }} />
          <Stack.Screen name="TRFinanceOps" component={TrainerFinanceOpsScreen} options={{ title: 'Kredi ve Finans' }} />
        </>
      ) : null}
      {role === 'secretary' ? (
        <>
          <Stack.Screen name="SECRegistrationOps" component={SecretaryRegistrationOpsScreen} options={{ title: 'Ogrenci Kayit' }} />
          <Stack.Screen name="SECStudentsOps" component={SecretaryStudentsOpsScreen} options={{ title: 'Ogrenci ve Odeme' }} />
          <Stack.Screen name="SECChatOps" component={SecretaryChatOpsScreen} options={{ title: 'Sohbet Operasyonlari' }} />
          <Stack.Screen name="SECPreRegistrationOps" component={SecretaryPreRegistrationOpsScreen} options={{ title: 'On Kayit Linki' }} />
        </>
      ) : null}
      {role === 'parent' ? (
        <>
          <Stack.Screen name="PRProgressOps" component={ParentProgressOpsScreen} options={{ title: 'Performans ve Baraj' }} />
          <Stack.Screen name="PRShoppingOps" component={ParentShoppingOpsScreen} options={{ title: 'Alisveris' }} />
          <Stack.Screen name="PRDailyOps" component={ParentDailyOpsScreen} options={{ title: 'Gunluk Yasam' }} />
          <Stack.Screen name="PRCommunicationOps" component={ParentCommunicationOpsScreen} options={{ title: 'Iletisim ve Destek' }} />
        </>
      ) : null}
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} options={{ title: 'Sohbet' }} />
    </Stack.Navigator>
  );
}

function ChatStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="ChatList" component={ChatListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} options={{ title: 'Sohbet' }} />
      <Stack.Screen name="NewChat" component={sharedStackScreens.find((item) => item.name === 'NewChat').component} options={{ title: 'Yeni Sohbet' }} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

export default function RoleNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginBottom: 4,
          letterSpacing: 0.2,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 10,
          paddingTop: 6,
          shadowColor: '#0f172a',
          shadowOpacity: 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -2 },
          elevation: 8,
        },
        tabBarItemStyle: {
          paddingTop: 4,
        },
        tabBarIcon: ({ color, focused }) => {
          const iconMap = {
            HomeTab: focused ? 'home' : 'home-outline',
            ModulesTab: focused ? 'grid' : 'grid-outline',
            ChatTab: focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline',
            ProfileTab: focused ? 'person-circle' : 'person-circle-outline',
          };
          return (
            <Ionicons
              name={iconMap[route.name]}
              size={focused ? 26 : 22}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: 'Ana Sayfa' }} />
      <Tab.Screen name="ModulesTab" component={ModulesStack} options={{ title: 'Moduller' }} />
      <Tab.Screen name="ChatTab" component={ChatStack} options={{ title: 'Sohbet' }} />
      <Tab.Screen name="ProfileTab" component={ProfileStack} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
}