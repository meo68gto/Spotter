import { Easing, FadeIn, FadeOut, LinearTransition, SlideInDown } from 'react-native-reanimated';

export const motion = {
  screenEnter: FadeIn.duration(260).easing(Easing.out(Easing.quad)),
  screenExit: FadeOut.duration(180),
  cardEnter: SlideInDown.duration(220).easing(Easing.out(Easing.cubic)),
  listLayout: LinearTransition.duration(200)
};
