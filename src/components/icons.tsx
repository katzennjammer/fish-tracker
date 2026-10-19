import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { color } from '../lib/theme';

export type IconName =
  | 'today' | 'fish' | 'people' | 'receipt' | 'more' | 'plus' | 'minus' | 'chevronRight' | 'chevronLeft'
  | 'close' | 'check' | 'trash' | 'share' | 'loan' | 'chart' | 'lock' | 'in' | 'out' | 'box' | 'alert'
  | 'search' | 'edit' | 'bell' | 'download' | 'upload' | 'cash' | 'phone' | 'leaf' | 'settings';

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

export function Icon({ name, size = 22, color: c = color.ink, strokeWidth = 1.8 }: Props) {
  const p = { stroke: c, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {render(name, p, c)}
    </Svg>
  );
}

function render(name: IconName, p: Record<string, unknown>, c: string) {
  switch (name) {
    case 'today':
      return (
        <>
          <Rect x={3.5} y={5} width={17} height={15.5} rx={2.5} {...p} />
          <Path d="M3.5 10h17M8 3v4M16 3v4" {...p} />
          <Circle cx={12} cy={15} r={1.6} fill={c} />
        </>
      );
    case 'fish':
      return (
        <>
          <Path d="M2.5 12c2.6-3.9 6.3-5.8 10.2-5.8 2.9 0 5.2 1.7 6.6 3.6L21.5 8v8l-2.2-1.8c-1.4 1.9-3.7 3.6-6.6 3.6-3.9 0-7.6-1.9-10.2-5.8z" {...p} />
          <Circle cx={7.4} cy={11.2} r={1.1} fill={c} />
          <Path d="M12 9.2c.9.8 1.4 1.8 1.4 2.8s-.5 2-1.4 2.8" {...p} />
        </>
      );
    case 'people':
      return (
        <>
          <Circle cx={9} cy={8} r={3.4} {...p} />
          <Path d="M2.8 20c.8-3.5 3.3-5.4 6.2-5.4s5.4 1.9 6.2 5.4" {...p} />
          <Path d="M15.5 4.9a3.2 3.2 0 0 1 0 6.2M17.6 14.9c1.9.6 3.1 2.3 3.6 4.7" {...p} />
        </>
      );
    case 'receipt':
      return (
        <>
          <Path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z" {...p} />
          <Path d="M9 8h6M9 11.5h6M9 15h3.5" {...p} />
        </>
      );
    case 'more':
      return (
        <>
          <Rect x={4} y={4} width={6.5} height={6.5} rx={1.6} {...p} />
          <Rect x={13.5} y={4} width={6.5} height={6.5} rx={1.6} {...p} />
          <Rect x={4} y={13.5} width={6.5} height={6.5} rx={1.6} {...p} />
          <Rect x={13.5} y={13.5} width={6.5} height={6.5} rx={1.6} {...p} />
        </>
      );
    case 'plus':
      return <Path d="M12 5v14M5 12h14" {...p} />;
    case 'minus':
      return <Path d="M5 12h14" {...p} />;
    case 'chevronRight':
      return <Path d="M9.5 6l6 6-6 6" {...p} />;
    case 'chevronLeft':
      return <Path d="M14.5 6l-6 6 6 6" {...p} />;
    case 'close':
      return <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" {...p} />;
    case 'check':
      return <Path d="M5 12.5l4.5 4.5L19 7.5" {...p} />;
    case 'trash':
      return <Path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7M10.2 10.5v6M13.8 10.5v6" {...p} />;
    case 'share':
      return <Path d="M12 3.5v11M8 7.5l4-4 4 4M6 11H5v9.5h14V11h-1" {...p} />;
    case 'loan':
      return (
        <>
          <Rect x={6} y={2.8} width={12} height={18.4} rx={2.4} {...p} />
          <Path d="M10.5 18h3" {...p} />
          <Path d="M10.4 13.2V7.2h2.2a1.8 1.8 0 0 1 0 3.6h-2.2M9.4 8.9h5.2" {...p} />
        </>
      );
    case 'chart':
      return <Path d="M3.5 20.5h17M6.5 16.5V12M11 16.5V6.5M15.5 16.5v-6.5M20 16.5V9" {...p} />;
    case 'lock':
      return (
        <>
          <Rect x={5} y={10.5} width={14} height={10} rx={2.2} {...p} />
          <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" {...p} />
          <Circle cx={12} cy={15.5} r={1.3} fill={c} />
        </>
      );
    case 'in':
      return <Path d="M12 4.5v14M6.5 13l5.5 5.5 5.5-5.5" {...p} />;
    case 'out':
      return <Path d="M12 19.5v-14M6.5 11l5.5-5.5 5.5 5.5" {...p} />;
    case 'box':
      return (
        <>
          <Path d="M3.5 7.5L12 3.5l8.5 4v9L12 20.5l-8.5-4z" {...p} />
          <Path d="M3.5 7.5L12 11.5l8.5-4M12 11.5v9" {...p} />
        </>
      );
    case 'alert':
      return (
        <>
          <Path d="M12 3.8L21.2 19.5H2.8z" {...p} />
          <Path d="M12 9.5v4.5" {...p} />
          <Circle cx={12} cy={16.7} r={1} fill={c} />
        </>
      );
    case 'search':
      return (
        <>
          <Circle cx={10.5} cy={10.5} r={6} {...p} />
          <Path d="M15 15l5 5" {...p} />
        </>
      );
    case 'edit':
      return <Path d="M4.5 19.5l1-4.3L15.8 4.9a2 2 0 0 1 2.9 0l.4.4a2 2 0 0 1 0 2.9L8.8 18.5zM13.8 6.9l3.3 3.3" {...p} />;
    case 'bell':
      return <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5h4" {...p} />;
    case 'download':
      return <Path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M4.5 19.5h15" {...p} />;
    case 'upload':
      return <Path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M4.5 19.5h15" {...p} />;
    case 'cash':
      return (
        <>
          <Rect x={2.8} y={6} width={18.4} height={12} rx={2} {...p} />
          <Circle cx={12} cy={12} r={2.6} {...p} />
          <Path d="M6 9.5v5M18 9.5v5" {...p} />
        </>
      );
    case 'phone':
      return <Path d="M6.8 3.5h2.6l1.4 4-2 1.3a10.5 10.5 0 0 0 6.4 6.4l1.3-2 4 1.4v2.6a2 2 0 0 1-2.2 2C10.6 18.6 5.4 13.4 4.8 5.7a2 2 0 0 1 2-2.2z" {...p} />;
    case 'leaf':
      return <Path d="M5 19c0-8 5-13.5 14.5-14-.3 9.5-6 14.5-14 14zM5 19l7-7" {...p} />;
    case 'settings':
      return (
        <>
          <Circle cx={12} cy={12} r={3} {...p} />
          <Path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" {...p} />
        </>
      );
  }
}
