import CollectionFormScreen from '../screens/shared/CollectionFormScreen';
import CollectionListScreen from '../screens/shared/CollectionListScreen';
import NewChatScreen from '../screens/shared/NewChatScreen';

export const sharedStackScreens = [
  { name: 'FeatureList', component: CollectionListScreen },
  { name: 'FeatureForm', component: CollectionFormScreen },
  { name: 'NewChat', component: NewChatScreen },
];