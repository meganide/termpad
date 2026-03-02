import powershellIcon from '../assets/icons/shells/powershell.svg';
import cmdIcon from '../assets/icons/shells/cmd.svg';
import bashIcon from '../assets/icons/shells/bash.svg';
import zshIcon from '../assets/icons/shells/zsh.svg';
import fishIcon from '../assets/icons/shells/fish.svg';
import gitBashIcon from '../assets/icons/shells/git-bash.svg';
import ubuntuIcon from '../assets/icons/shells/ubuntu.svg';
import archIcon from '../assets/icons/shells/arch.svg';
import debianIcon from '../assets/icons/shells/debian.svg';
import genericIcon from '../assets/icons/shells/generic.svg';

const shellIcons: Record<string, string> = {
  powershell: powershellIcon,
  cmd: cmdIcon,
  bash: bashIcon,
  zsh: zshIcon,
  fish: fishIcon,
  'git-bash': gitBashIcon,
  ubuntu: ubuntuIcon,
  arch: archIcon,
  debian: debianIcon,
  generic: genericIcon,
};

interface ShellIconProps {
  shellId: string;
  className?: string;
  size?: number;
}

export function ShellIcon({ shellId, className = '', size = 16 }: ShellIconProps) {
  const iconSrc = shellIcons[shellId] || shellIcons.generic;

  return (
    <img
      src={iconSrc}
      alt={`${shellId} shell icon`}
      className={`dark:invert dark:brightness-90 ${className}`}
      width={size}
      height={size}
      style={{ display: 'inline-block' }}
    />
  );
}
