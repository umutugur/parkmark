import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/theme';

export interface AppModalButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface AppModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  buttons?: AppModalButton[];
  onClose?: () => void;
}

export const AppModal: React.FC<AppModalProps> = ({
  visible,
  title,
  message,
  buttons = [{ text: 'Tamam' }],
  onClose,
}) => {
  const handlePress = (btn: AppModalButton) => {
    onClose?.();
    setTimeout(() => btn.onPress?.(), 100);
  };

  const cancelBtn = buttons.find((b) => b.style === 'cancel');
  const otherBtns = buttons.filter((b) => b.style !== 'cancel');
  const isSheet = buttons.length >= 3;

  if (isSheet) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          onClose?.();
          cancelBtn?.onPress?.();
        }}
      >
        <View style={styles.sheetWrapper}>
          <TouchableWithoutFeedback
            onPress={() => {
              onClose?.();
              cancelBtn?.onPress?.();
            }}
          >
            <View style={styles.sheetOverlay} />
          </TouchableWithoutFeedback>

          <View style={styles.sheet}>
            {!!title && <Text style={styles.sheetTitle}>{title}</Text>}
            {!!message && <Text style={styles.sheetMessage}>{message}</Text>}

            {otherBtns.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.sheetBtn,
                  i > 0 && styles.sheetBtnBorder,
                  btn.style === 'destructive' && styles.sheetBtnDestructive,
                ]}
                onPress={() => handlePress(btn)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.sheetBtnText,
                    btn.style === 'destructive' && styles.sheetBtnTextDestructive,
                  ]}
                >
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}

            {cancelBtn && (
              <TouchableOpacity
                style={[styles.sheetBtn, styles.sheetCancelBtn]}
                onPress={() => handlePress(cancelBtn)}
                activeOpacity={0.7}
              >
                <Text style={styles.sheetCancelText}>{cancelBtn.text}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  // Centered dialog
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.dialogOverlay}>
        <View style={styles.dialog}>
          {!!title && <Text style={styles.dialogTitle}>{title}</Text>}
          {!!message && <Text style={styles.dialogMessage}>{message}</Text>}

          <View style={styles.dialogButtons}>
            {buttons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.dialogBtn,
                  i > 0 && styles.dialogBtnMarginTop,
                  btn.style === 'cancel' && styles.dialogBtnCancel,
                  btn.style === 'destructive' && styles.dialogBtnDestructive,
                  (btn.style == null || btn.style === 'default') && styles.dialogBtnDefault,
                ]}
                onPress={() => handlePress(btn)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.dialogBtnText,
                    btn.style === 'cancel' && styles.dialogBtnTextCancel,
                    btn.style === 'destructive' && styles.dialogBtnTextDestructive,
                    (btn.style == null || btn.style === 'default') && styles.dialogBtnTextDefault,
                  ]}
                >
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // ── Bottom Sheet ──────────────────────────────────────────────────────────
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetTitle: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.semibold,
    color: Colors.textSecondary,
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  sheetMessage: {
    fontSize: FontSizes.caption,
    color: Colors.textSecondary,
    fontFamily: 'NunitoSans-Regular',
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sheetBtn: {
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  sheetBtnBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  sheetBtnDestructive: {},
  sheetBtnText: {
    fontSize: FontSizes.body,
    color: Colors.textPrimary,
    fontFamily: 'NunitoSans-Medium',
  },
  sheetBtnTextDestructive: {
    color: Colors.error,
    fontFamily: 'NunitoSans-Medium',
  },
  sheetCancelBtn: {
    marginTop: Spacing.sm,
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
  },
  sheetCancelText: {
    fontSize: FontSizes.body,
    color: Colors.textSecondary,
    fontFamily: 'NunitoSans-Medium',
  },

  // ── Centered Dialog ───────────────────────────────────────────────────────
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  dialog: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dialogTitle: {
    fontSize: FontSizes.subheading,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  dialogMessage: {
    fontSize: FontSizes.body,
    color: Colors.textSecondary,
    fontFamily: 'NunitoSans-Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  dialogButtons: {
    marginTop: Spacing.xs,
  },
  dialogBtn: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  dialogBtnMarginTop: {
    marginTop: Spacing.sm,
  },
  dialogBtnDefault: {
    backgroundColor: Colors.primary,
  },
  dialogBtnCancel: {
    backgroundColor: Colors.surface,
  },
  dialogBtnDestructive: {
    backgroundColor: Colors.error,
  },
  dialogBtnText: {
    fontSize: FontSizes.body,
    fontFamily: 'NunitoSans-Medium',
    fontWeight: FontWeights.semibold,
  },
  dialogBtnTextDefault: {
    color: Colors.bgDeep,
    fontFamily: 'Poppins-SemiBold',
  },
  dialogBtnTextCancel: {
    color: Colors.textSecondary,
  },
  dialogBtnTextDestructive: {
    color: Colors.textPrimary,
    fontFamily: 'Poppins-SemiBold',
  },
});
