import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageBackground,
  ScrollView,
  Dimensions,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WORK_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;

const STORAGE_KEY_TREES = '@pomodoro_bogi_daraxtlar_v1';
const STORAGE_KEY_LAST_TREE = '@pomodoro_bogi_oxirgi_daraxt_v1';

const GRID_COLUMNS = 4;
const SCREEN_PADDING = 20; // ScrollView contentContainer paddingHorizontal
const CARD_PADDING = 16; // gardenCard padding
const GARDEN_WIDTH = SCREEN_WIDTH - SCREEN_PADDING * 2 - CARD_PADDING * 2;
const CELL_SIZE = GARDEN_WIDTH / GRID_COLUMNS;
const CELL_HEIGHT = CELL_SIZE * 0.92;

const COLORS = {
  bg: '#F6F1E4',
  card: '#FFFFFF',
  darkGreen: '#2E4A30',
  midGreen: '#5B7F4F',
  lightGreen: '#D7E4CB',
  brown: '#7A5A3A',
  lightBrown: '#E3D2B8',
  cream: '#FAF4E6',
  textDark: '#2B2B25',
  textMuted: '#7C7567',
  orange: '#D78B3D',
  danger: '#B6533F',
  white: '#FFFFFF',
};

const TREE_OPTIONS = [
  { id: 'tree', label: 'Bahor', source: require('./assets/tree.png') },
  { id: 'tree1', label: 'Gulzor', source: require('./assets/tree1.png') },
  { id: 'tree3', label: 'Kuz', source: require('./assets/tree3.png') },
  { id: 'tree4', label: 'Sehrli', source: require('./assets/tree4.png') },
];

function getTreeSource(type) {
  const found = TREE_OPTIONS.find((t) => t.id === type);
  return found ? found.source : TREE_OPTIONS[0].source;
}

function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = String(Math.floor(safe / 60)).padStart(2, '0');
  const s = String(safe % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function ProgressBar({ progress, color }) {
  const pct = Math.min(100, Math.max(0, progress * 100));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

function TreeThumb({ option, selected, disabled, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.treeThumb,
        selected && styles.treeThumbSelected,
        disabled && !selected && styles.treeThumbDisabled,
      ]}
    >
      <Image source={option.source} style={styles.treeThumbImage} resizeMode="contain" />
      <Text style={[styles.treeThumbLabel, selected && styles.treeThumbLabelSelected]}>
        {option.label}
      </Text>
    </TouchableOpacity>
  );
}

export default function App() {
  const [trees, setTrees] = useState([]);
  const [selectedTreeType, setSelectedTreeType] = useState(null);
  const [mode, setMode] = useState('idle'); // 'idle' | 'work' | 'break'
  const [timeLeft, setTimeLeft] = useState(WORK_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const intervalRef = useRef(null);
  const modeRef = useRef(mode);
  const selectedTreeRef = useRef(selectedTreeType);
  const treesRef = useRef(trees);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    selectedTreeRef.current = selectedTreeType;
  }, [selectedTreeType]);

  useEffect(() => {
    treesRef.current = trees;
  }, [trees]);

  // Saqlangan maʼlumotlarni yuklash
  useEffect(() => {
    (async () => {
      try {
        const storedTrees = await AsyncStorage.getItem(STORAGE_KEY_TREES);
        if (storedTrees) setTrees(JSON.parse(storedTrees));
        const lastTree = await AsyncStorage.getItem(STORAGE_KEY_LAST_TREE);
        if (lastTree) setSelectedTreeType(lastTree);
      } catch (e) {
        console.log('Maʼlumotlarni yuklashda xatolik:', e);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  // Daraxtlar roʻyxati oʻzgarganda xotiraga saqlash
  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEY_TREES, JSON.stringify(trees)).catch((e) =>
      console.log('Saqlashda xatolik:', e)
    );
  }, [trees, isLoaded]);

  // Taymer mexanizmi
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
            handleSessionComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  function handleSessionComplete() {
    setIsRunning(false);
    if (modeRef.current === 'work') {
      const index = treesRef.current.length;
      const col = index % GRID_COLUMNS;
      const row = Math.floor(index / GRID_COLUMNS);
      const newTree = {
        id: `${Date.now()}`,
        type: selectedTreeRef.current || TREE_OPTIONS[0].id,
        col,
        row,
        plantedAt: new Date().toISOString(),
      };
      setTrees((prev) => [...prev, newTree]);
      setMode('break');
      setTimeLeft(BREAK_DURATION);
      Alert.alert('Tabriklaymiz! 🌳', 'Yangi daraxt bogʻingizga ekildi. Endi dam oling.');
    } else if (modeRef.current === 'break') {
      setMode('idle');
      setTimeLeft(WORK_DURATION);
      Alert.alert('Dam olish tugadi', 'Keyingi pomodoro uchun tayyor boʻlganingizda boshlang.');
    }
  }

  function handleSelectTree(type) {
    if (mode !== 'idle') return;
    setSelectedTreeType(type);
    AsyncStorage.setItem(STORAGE_KEY_LAST_TREE, type).catch(() => {});
  }

  function handleStart() {
    if (mode === 'idle') {
      if (!selectedTreeType) {
        Alert.alert('Diqqat', 'Avval bogʻ uchun daraxt turini tanlang.');
        return;
      }
      setMode('work');
      setTimeLeft(WORK_DURATION);
      setIsRunning(true);
    } else {
      setIsRunning(true);
    }
  }

  function handlePause() {
    setIsRunning(false);
  }

  function resetToIdle() {
    setIsRunning(false);
    setMode('idle');
    setTimeLeft(WORK_DURATION);
  }

  function handleCancel() {
    if (mode === 'work') {
      Alert.alert(
        'Bekor qilinsinmi?',
        'Vaqt tugamasdan toʻxtatsangiz, daraxt ekilmaydi.',
        [
          { text: 'Yoʻq', style: 'cancel' },
          { text: 'Ha, bekor qilish', style: 'destructive', onPress: resetToIdle },
        ]
      );
    } else {
      resetToIdle();
    }
  }

  function handleSkipBreak() {
    setIsRunning(false);
    setMode('idle');
    setTimeLeft(WORK_DURATION);
  }

  const totalDuration = mode === 'break' ? BREAK_DURATION : WORK_DURATION;
  const progress = mode === 'idle' ? 0 : (totalDuration - timeLeft) / totalDuration;
  const progressColor = mode === 'break' ? COLORS.orange : COLORS.darkGreen;

  const rows = Math.max(2, Math.ceil((trees.length + 1) / GRID_COLUMNS));
  const gardenHeight = rows * CELL_HEIGHT;

  let modeLabel = 'Boshlashga tayyormisiz?';
  if (mode === 'work') modeLabel = isRunning ? 'Diqqat vaqti 🌿' : 'Diqqat vaqti (pauzada)';
  if (mode === 'break') modeLabel = isRunning ? 'Dam olish vaqti ☕' : 'Dam olishga tayyor';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Pomodoro Bogʻi</Text>
          <Text style={styles.headerSubtitle}>Har bir gʻalaba — yangi daraxt 🌱</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{trees.length}</Text>
            <Text style={styles.statLabel}>ekilgan daraxt</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{Math.floor((trees.length * 25) / 60)}</Text>
            <Text style={styles.statLabel}>soat fokus</Text>
          </View>
        </View>

        <View style={styles.gardenCard}>
          <Text style={styles.sectionTitle}>Mening bogʻim</Text>
          <View style={[styles.gardenFrame, { height: gardenHeight }]}>
            <ImageBackground
              source={require('./assets/Poliya.png')}
              style={{ width: GARDEN_WIDTH, height: gardenHeight }}
              imageStyle={styles.gardenImage}
              resizeMode="stretch"
            >
              {trees.map((tree) => {
                const treeSize = CELL_SIZE * 0.8;
                const left = tree.col * CELL_SIZE + (CELL_SIZE - treeSize) / 2;
                const top = tree.row * CELL_HEIGHT + (CELL_HEIGHT - treeSize) - 4;
                return (
                  <Image
                    key={tree.id}
                    source={getTreeSource(tree.type)}
                    style={{
                      position: 'absolute',
                      left,
                      top,
                      width: treeSize,
                      height: treeSize,
                    }}
                    resizeMode="contain"
                  />
                );
              })}
            </ImageBackground>
          </View>
          {trees.length === 0 && (
            <Text style={styles.gardenHint}>
              Birinchi pomodoroni tugating va bogʻingiz unib chiqsin!
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Daraxt tanlang</Text>
          <View style={styles.treeMenuRow}>
            {TREE_OPTIONS.map((option) => (
              <TreeThumb
                key={option.id}
                option={option}
                selected={selectedTreeType === option.id}
                disabled={mode !== 'idle'}
                onPress={() => handleSelectTree(option.id)}
              />
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.modeLabel}>{modeLabel}</Text>
          <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
          <ProgressBar progress={progress} color={progressColor} />

          <View style={styles.buttonRow}>
            {mode === 'idle' && (
              <TouchableOpacity
                style={[styles.primaryButton, !selectedTreeType && styles.buttonDisabled]}
                onPress={handleStart}
                disabled={!selectedTreeType}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>Boshlash</Text>
              </TouchableOpacity>
            )}

            {mode !== 'idle' && isRunning && (
              <React.Fragment>
                <TouchableOpacity style={styles.secondaryButton} onPress={handlePause} activeOpacity={0.85}>
                  <Text style={styles.secondaryButtonText}>Pauza</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dangerButton}
                  onPress={mode === 'break' ? handleSkipBreak : handleCancel}
                  activeOpacity={0.85}
                >
                  <Text style={styles.dangerButtonText}>
                    {mode === 'break' ? 'Oʻtkazib yuborish' : 'Bekor qilish'}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            )}

            {mode !== 'idle' && !isRunning && (
              <React.Fragment>
                <TouchableOpacity style={styles.primaryButton} onPress={handleStart} activeOpacity={0.85}>
                  <Text style={styles.primaryButtonText}>
                    {mode === 'break' ? 'Dam olishni boshlash' : 'Davom ettirish'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dangerButton}
                  onPress={mode === 'break' ? handleSkipBreak : handleCancel}
                  activeOpacity={0.85}
                >
                  <Text style={styles.dangerButtonText}>
                    {mode === 'break' ? 'Oʻtkazib yuborish' : 'Bekor qilish'}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            )}
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: Platform.OS === 'android' ? 24 : 8,
    paddingBottom: 12,
  },
  header: { marginBottom: 18, alignItems: 'center' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.darkGreen, letterSpacing: 0.3 },
  headerSubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },

  statsRow: { flexDirection: 'row', marginBottom: 18 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.darkGreen },
  statLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  gardenCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: CARD_PADDING,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  gardenFrame: {
    width: GARDEN_WIDTH,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: COLORS.lightGreen,
  },
  gardenImage: { borderRadius: 18 },
  gardenHint: { fontSize: 12, color: COLORS.textMuted, marginTop: 10, textAlign: 'center' },

  treeMenuRow: { flexDirection: 'row', justifyContent: 'space-between' },
  treeThumb: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  treeThumbSelected: { borderColor: COLORS.darkGreen, backgroundColor: COLORS.lightGreen },
  treeThumbDisabled: { opacity: 0.45 },
  treeThumbImage: { width: 44, height: 44, marginBottom: 6 },
  treeThumbLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  treeThumbLabelSelected: { color: COLORS.darkGreen },

  modeLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 6,
    fontWeight: '600',
  },
  timerText: {
    fontSize: 52,
    fontWeight: '800',
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: 1,
  },

  progressTrack: {
    height: 12,
    borderRadius: 8,
    backgroundColor: COLORS.lightBrown,
    overflow: 'hidden',
    marginBottom: 18,
  },
  progressFill: { height: '100%', borderRadius: 8 },

  buttonRow: { flexDirection: 'row', justifyContent: 'center' },
  primaryButton: {
    flex: 1,
    backgroundColor: COLORS.darkGreen,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  primaryButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  buttonDisabled: { opacity: 0.4 },
  secondaryButton: {
    flex: 1,
    backgroundColor: COLORS.lightBrown,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  secondaryButtonText: { color: COLORS.brown, fontWeight: '700', fontSize: 15 },
  dangerButton: {
    flex: 1,
    backgroundColor: COLORS.cream,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginHorizontal: 5,
    borderWidth: 1.5,
    borderColor: COLORS.danger,
  },
  dangerButtonText: { color: COLORS.danger, fontWeight: '700', fontSize: 13 },
});
