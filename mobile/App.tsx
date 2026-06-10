import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Platform, BackHandler, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Notifications from 'expo-notifications';
import * as Calendar from 'expo-calendar';
import * as ImagePicker from 'expo-image-picker';
import Purchases from 'react-native-purchases';
import { InterstitialAd, RewardedAd, TestIds, AdEventType, RewardedAdEventType } from 'react-native-google-mobile-ads';
import { StatusBar } from 'expo-status-bar';

// Setup AdMob Test IDs (Replace with real ones for production)
const interstitialAdUnitId = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-xxxxxxxxxxx/xxxxxxxxxxx';
const rewardedAdUnitId = __DEV__ ? TestIds.REWARDED : 'ca-app-pub-xxxxxxxxxxx/xxxxxxxxxxx';

const interstitialAd = InterstitialAd.createForAdRequest(interstitialAdUnitId, {
  keywords: ['finance', 'budget', 'business'],
});

const rewardedAd = RewardedAd.createForAdRequest(rewardedAdUnitId, {
  keywords: ['finance', 'budget', 'business'],
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  const webviewRef = useRef<WebView>(null);
  const [pushToken, setPushToken] = useState<string | null>(null);

  useEffect(() => {
    // 1. Configure Notifications
    setupNotifications();
    // 2. Configure Purchases (RevenueCat)
    setupPurchases();
    // 3. Load Ads
    interstitialAd.load();
    rewardedAd.load();

    const handleBackPress = () => {
      if (webviewRef.current) {
        webviewRef.current.goBack();
        return true;
      }
      return false;
    };

    BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => {
      BackHandler.removeEventListener('hardwareBackPress', handleBackPress);
    };
  }, []);

  const setupNotifications = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus === 'granted') {
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      setPushToken(token);
    }
  };

  const setupPurchases = async () => {
    if (Platform.OS === 'ios') {
      // Purchases.configure({ apiKey: "YOUR_REVENUECAT_APPLE_API_KEY" });
    } else if (Platform.OS === 'android') {
      // Purchases.configure({ apiKey: "YOUR_REVENUECAT_GOOGLE_API_KEY" });
    }
  };

  const sendMessageToWeb = (type: string, payload: any) => {
    const message = JSON.stringify({ type, ...payload });
    const script = `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(message)} })); true;`;
    webviewRef.current?.injectJavaScript(script);
  };

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('Received Message from Web:', data.type);

      switch (data.type) {
        case 'getPushToken':
          if (pushToken) {
            sendMessageToWeb('pushToken', { token: pushToken });
          } else {
            setupNotifications().then(() => {
              if (pushToken) sendMessageToWeb('pushToken', { token: pushToken });
            });
          }
          break;

        case 'schedulePaymentNotifications':
          for (const instance of data.instances) {
            // Schedule using exp-notifications
            const d = new Date(instance.dueDate);
            await Notifications.scheduleNotificationAsync({
               content: {
                 title: 'Payment Due',
                 body: `Your payment for ${data.title} is due today!`,
                 data: { instanceId: instance.id },
               },
               trigger: d,
            });
          }
          break;
          
        case 'cancelNotification':
        case 'cancelAllNotifications':
           await Notifications.cancelAllScheduledNotificationsAsync();
           break;

        case 'syncToCalendar':
          const { status } = await Calendar.requestCalendarPermissionsAsync();
          if (status === 'granted') {
            const defaultCalendarSource = Platform.OS === 'ios'
              ? await Calendar.getDefaultCalendarAsync()
              : { isLocalAccount: true, name: 'YouFI' };
              
            // Example logic for calendar sync
            Alert.alert("Calendar Sync", `Synced ${data.instances.length} events to calendar!`);
          } else {
             Alert.alert("Permission Required", "Calendar permission is needed.");
          }
          break;

        case 'scanReceipt':
        case 'scanProductImage':
          const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
          if (permissionResult.granted) {
            const pickerResult = await ImagePicker.launchCameraAsync();
            if (!pickerResult.canceled) {
               // We would usually extract base64 and send it back, or upload
               // For now, notify web app (Assuming it takes base64)
               sendMessageToWeb('photoCaptured', { uri: pickerResult.assets[0].uri });
               Alert.alert("Photo Taken!", "This will be analyzed by Gemini backend!");
            }
          }
          break;

        case 'purchasePremium':
           try {
              // Wait for user to interact with the sheet
              Alert.alert('Sandbox Purchase', 'Simulate a native payment?', [
                {
                   text: 'Cancel',
                   style: 'cancel'
                },
                {
                   text: 'Purchase',
                   onPress: () => {
                     // Simulate successful native purchase
                     sendMessageToWeb('premiumStatusChanged', { isPremium: true });
                   }
                }
              ]);
              /*
              // Real RevenueCat Implementation:
              const { customerInfo } = await Purchases.purchasePackage(packages[0]);
              if (typeof customerInfo.entitlements.active["premium"] !== "undefined") {
                 sendMessageToWeb('premiumStatusChanged', { isPremium: true });
              }
              */
           } catch (e) {
              console.warn(e);
           }
           break;

        case 'showRewardedAd':
           if (rewardedAd.loaded) {
              rewardedAd.show();
              // Load the next one
              rewardedAd.load();
           } else {
              Alert.alert("Ad not ready", "Try again soon.");
           }
           break;

        case 'showInterstitialAd':
           if (interstitialAd.loaded) {
              interstitialAd.show();
              interstitialAd.load();
           }
           break;

        case 'log':
          console.log('[Web Log]:', data.message);
          break;
      }
    } catch (e) {
       console.error("Error handling message from web", e);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <WebView
        ref={webviewRef}
        source={{ uri: 'https://youfi.vercel.app' }}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        bounces={false}
        overScrollMode="never"
        pullToRefreshEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? 24 : 44, // Safe area
  },
});
