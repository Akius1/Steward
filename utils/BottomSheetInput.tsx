/**
 * Web-safe BottomSheetTextInput wrapper.
 *
 * @gorhom/bottom-sheet's BottomSheetTextInput registers a blur handler that
 * calls findNodeHandle(ref._scrollRef) — but on React Native Web the scroll
 * ref inside the sheet is null, causing:
 *   "Cannot read properties of null (reading '_scrollRef')"
 *
 * On web a plain TextInput is sufficient (keyboard avoidance is handled by
 * the browser). On native we still use the real BottomSheetTextInput so the
 * sheet pans up correctly when the keyboard appears.
 */
import { Platform, TextInput } from 'react-native';
import { BottomSheetTextInput as NativeBottomSheetTextInput } from '@gorhom/bottom-sheet';

export const BottomSheetInput =
  Platform.OS === 'web'
    ? TextInput
    : (NativeBottomSheetTextInput as unknown as typeof TextInput);
