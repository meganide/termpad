import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store original platform to restore after tests
const originalPlatform = process.platform;

// Helper to set platform
function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true,
    configurable: true,
  });
}

// Mock implementations that we'll configure per test
let mockFsAccess: (path: string | Buffer | URL, mode?: number) => Promise<void>;
let mockFsReadFile: (path: string) => Promise<string>;
let mockFsStat: (path: string) => Promise<{ isDirectory: () => boolean }>;
let mockExecAsync: (cmd: string, opts?: object) => Promise<{ stdout: string | Buffer; stderr: string }>;

// Mock fs/promises
vi.mock('fs/promises', () => ({
  access: vi.fn((path: string | Buffer | URL, mode?: number) => mockFsAccess(path, mode)),
  readFile: vi.fn((path: string) => mockFsReadFile(path)),
  stat: vi.fn((path: string) => mockFsStat(path)),
  constants: {
    F_OK: 0,
    X_OK: 1,
  },
  default: {
    access: vi.fn((path: string | Buffer | URL, mode?: number) => mockFsAccess(path, mode)),
    readFile: vi.fn((path: string) => mockFsReadFile(path)),
    stat: vi.fn((path: string) => mockFsStat(path)),
    constants: { F_OK: 0, X_OK: 1 },
  },
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
  default: { exec: vi.fn() },
}));

// Mock util.promisify to return our mock
vi.mock('util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('util')>();
  return {
    ...actual,
    promisify: vi.fn(() => mockExecAsync),
    default: { ...actual, promisify: vi.fn(() => mockExecAsync) },
  };
});

describe('shellDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: file doesn't exist
    mockFsAccess = async () => {
      throw new Error('ENOENT');
    };
    mockFsReadFile = async () => {
      throw new Error('ENOENT');
    };
    mockFsStat = async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    };
    mockExecAsync = async () => {
      throw new Error('Command not found');
    };
  });

  afterEach(() => {
    // Restore original platform
    setPlatform(originalPlatform);
    vi.resetModules();
  });

  describe('detectAvailableShells (Windows)', () => {
    beforeEach(() => {
      setPlatform('win32');
      // Set Windows environment variables
      process.env.SystemRoot = 'C:\\Windows';
      process.env.COMSPEC = 'C:\\Windows\\System32\\cmd.exe';
      process.env.ProgramFiles = 'C:\\Program Files';
      process.env['ProgramFiles(x86)'] = 'C:\\Program Files (x86)';
    });

    it('should detect Windows PowerShell', async () => {
      // Make PowerShell exist
      mockFsAccess = async (path) => {
        if (String(path).includes('powershell.exe')) {
          return undefined;
        }
        throw new Error('ENOENT');
      };

      // Mock exec for pwsh (not found) and wsl (not installed)
      mockExecAsync = async () => {
        throw new Error('Not found');
      };

      vi.resetModules();
      const { detectAvailableShells } = await import('./shellDetector');
      const shells = await detectAvailableShells();

      expect(shells).toContainEqual(
        expect.objectContaining({
          id: 'powershell',
          name: 'Windows PowerShell',
          icon: 'powershell',
        })
      );
    });

    it('should detect PowerShell Core (pwsh) when available', async () => {
      // Make pwsh exist via where command
      mockExecAsync = async (cmd) => {
        if (cmd.includes('where pwsh')) {
          return { stdout: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe\n', stderr: '' };
        }
        throw new Error('Not found');
      };

      // Make files exist for detected paths
      mockFsAccess = async (path) => {
        const pathStr = String(path);
        if (pathStr.includes('pwsh.exe') || pathStr.includes('powershell.exe')) {
          return undefined;
        }
        throw new Error('ENOENT');
      };

      vi.resetModules();
      const { detectAvailableShells } = await import('./shellDetector');
      const shells = await detectAvailableShells();

      expect(shells).toContainEqual(
        expect.objectContaining({
          id: 'pwsh',
          name: 'PowerShell',
          icon: 'powershell',
        })
      );
    });

    it('should detect Command Prompt', async () => {
      mockFsAccess = async (path) => {
        if (String(path).includes('cmd.exe')) {
          return undefined;
        }
        throw new Error('ENOENT');
      };

      mockExecAsync = async () => {
        throw new Error('Not found');
      };

      vi.resetModules();
      const { detectAvailableShells } = await import('./shellDetector');
      const shells = await detectAvailableShells();

      expect(shells).toContainEqual(
        expect.objectContaining({
          id: 'cmd',
          name: 'Command Prompt',
          icon: 'cmd',
        })
      );
    });

    it('should detect Git Bash', async () => {
      mockFsAccess = async (path) => {
        if (String(path).includes('Git') && String(path).includes('bash.exe')) {
          return undefined;
        }
        throw new Error('ENOENT');
      };

      mockExecAsync = async () => {
        throw new Error('Not found');
      };

      vi.resetModules();
      const { detectAvailableShells } = await import('./shellDetector');
      const shells = await detectAvailableShells();

      expect(shells).toContainEqual(
        expect.objectContaining({
          id: 'git-bash',
          name: 'Git Bash',
          icon: 'git-bash',
        })
      );
    });

    it('should detect WSL distributions', async () => {
      // Mock wsl --list --quiet returning Ubuntu
      mockExecAsync = async (cmd) => {
        if (cmd.includes('wsl --list')) {
          // Return UTF-16LE encoded output
          const output = 'Ubuntu\r\n';
          const buffer = Buffer.from(output, 'utf16le');
          return { stdout: buffer, stderr: '' };
        }
        throw new Error('Not found');
      };

      mockFsAccess = async (path) => {
        if (String(path).includes('wsl.exe')) {
          return undefined;
        }
        throw new Error('ENOENT');
      };

      vi.resetModules();
      const { detectAvailableShells } = await import('./shellDetector');
      const shells = await detectAvailableShells();

      expect(shells).toContainEqual(
        expect.objectContaining({
          id: 'wsl-ubuntu',
          name: 'Ubuntu (WSL)',
          icon: 'ubuntu',
          args: ['-d', 'Ubuntu'],
        })
      );
    });

    it('should assign correct icons to WSL distros', async () => {
      const distros = ['Ubuntu', 'Debian', 'Arch', 'Fedora', 'openSUSE-Leap', 'kali-linux', 'Alpine'];

      mockExecAsync = async (cmd) => {
        if (cmd.includes('wsl --list')) {
          const output = distros.join('\r\n') + '\r\n';
          const buffer = Buffer.from(output, 'utf16le');
          return { stdout: buffer, stderr: '' };
        }
        throw new Error('Not found');
      };

      mockFsAccess = async (path) => {
        if (String(path).includes('wsl.exe')) {
          return undefined;
        }
        throw new Error('ENOENT');
      };

      vi.resetModules();
      const { detectAvailableShells } = await import('./shellDetector');
      const shells = await detectAvailableShells();

      expect(shells.find((s) => s.id === 'wsl-ubuntu')?.icon).toBe('ubuntu');
      expect(shells.find((s) => s.id === 'wsl-debian')?.icon).toBe('debian');
      expect(shells.find((s) => s.id === 'wsl-arch')?.icon).toBe('arch');
      expect(shells.find((s) => s.id === 'wsl-fedora')?.icon).toBe('fedora');
      expect(shells.find((s) => s.id === 'wsl-opensuse-leap')?.icon).toBe('suse');
      expect(shells.find((s) => s.id === 'wsl-kali-linux')?.icon).toBe('kali');
      expect(shells.find((s) => s.id === 'wsl-alpine')?.icon).toBe('alpine');
    });

    it('should skip Docker WSL distributions', async () => {
      mockExecAsync = async (cmd) => {
        if (cmd.includes('wsl --list')) {
          const output = 'Ubuntu\r\ndocker-desktop\r\ndocker-desktop-data\r\n';
          const buffer = Buffer.from(output, 'utf16le');
          return { stdout: buffer, stderr: '' };
        }
        throw new Error('Not found');
      };

      mockFsAccess = async (path) => {
        if (String(path).includes('wsl.exe')) {
          return undefined;
        }
        throw new Error('ENOENT');
      };

      vi.resetModules();
      const { detectAvailableShells } = await import('./shellDetector');
      const shells = await detectAvailableShells();

      expect(shells.find((s) => s.id.includes('docker'))).toBeUndefined();
      expect(shells.find((s) => s.id === 'wsl-ubuntu')).toBeDefined();
    });

    it('should handle WSL not being installed', async () => {
      mockExecAsync = async () => {
        throw new Error('WSL not installed');
      };

      mockFsAccess = async () => {
        throw new Error('ENOENT');
      };

      vi.resetModules();
      const { detectAvailableShells } = await import('./shellDetector');
      const shells = await detectAvailableShells();

      // Should still return array (possibly empty or with other shells)
      expect(Array.isArray(shells)).toBe(true);
      expect(shells.find((s) => s.id.startsWith('wsl-'))).toBeUndefined();
    });
  });

  describe('detectAvailableShells (Unix/Linux/macOS)', () => {
    beforeEach(() => {
      setPlatform('linux');
    });

    it('should detect shells from /etc/shells', async () => {
      const etcShells = `# /etc/shells
/bin/sh
/bin/bash
/usr/bin/bash
/bin/zsh
/usr/bin/zsh
/usr/bin/fish
`;

      mockFsReadFile = async () => etcShells;
      mockFsAccess = async () => undefined;

      vi.resetModules();
      const { detectAvailableShells } = await import('./shellDetector');
      const shells = await detectAvailableShells();

      expect(shells.length).toBeGreaterThan(0);

      // Check for expected shells
      expect(shells.find((s) => s.name === 'Bash')).toBeDefined();
      expect(shells.find((s) => s.name === 'Zsh')).toBeDefined();
      expect(shells.find((s) => s.name === 'Fish')).toBeDefined();
      expect(shells.find((s) => s.name === 'sh')).toBeDefined();
    });

    it('should prioritize common shells in order', async () => {
      const etcShells = `# /etc/shells
/bin/sh
/bin/tcsh
/bin/fish
/bin/bash
/bin/zsh
`;

      mockFsReadFile = async () => etcShells;
      mockFsAccess = async () => undefined;

      vi.resetModules();
      const { detectAvailableShells } = await import('./shellDetector');
      const shells = await detectAvailableShells();

      // Common shells should be first: zsh, bash, fish, sh
      const ids = shells.map((s) => s.id);
      const zshIndex = ids.indexOf('zsh');
      const bashIndex = ids.indexOf('bash');
      const fishIndex = ids.indexOf('fish');
      const shIndex = ids.indexOf('sh');
      const tcshIndex = ids.indexOf('tcsh');

      expect(zshIndex).toBeLessThan(bashIndex);
      expect(bashIndex).toBeLessThan(fishIndex);
      expect(fishIndex).toBeLessThan(shIndex);
      expect(shIndex).toBeLessThan(tcshIndex);
    });

    it('should skip commented lines in /etc/shells', async () => {
      const etcShells = `# This is a comment
/bin/bash
# /bin/sh
/bin/zsh
`;

      mockFsReadFile = async () => etcShells;
      mockFsAccess = async () => undefined;

      vi.resetModules();
      const { detectAvailableShells } = await import('./shellDetector');
      const shells = await detectAvailableShells();

      expect(shells.find((s) => s.path === '/bin/bash')).toBeDefined();
      expect(shells.find((s) => s.path === '/bin/zsh')).toBeDefined();
      // /bin/sh was commented out so shouldn't be included
      expect(shells.filter((s) => s.path === '/bin/sh')).toHaveLength(0);
    });

    it('should deduplicate shells with same path', async () => {
      const etcShells = `/bin/bash
/bin/bash
/usr/bin/bash
`;

      mockFsReadFile = async () => etcShells;
      mockFsAccess = async () => undefined;

      vi.resetModules();
      const { detectAvailableShells } = await import('./shellDetector');
      const shells = await detectAvailableShells();

      // Should only have one entry for /bin/bash and one for /usr/bin/bash
      expect(shells.filter((s) => s.path === '/bin/bash')).toHaveLength(1);
    });

    it('should skip shells that do not exist', async () => {
      const etcShells = `/bin/bash
/bin/zsh
/bin/nonexistent
`;

      mockFsReadFile = async () => etcShells;
      mockFsAccess = async (path) => {
        if (String(path).includes('nonexistent')) {
          throw new Error('ENOENT');
        }
        return undefined;
      };

      vi.resetModules();
      const { detectAvailableShells } = await import('./shellDetector');
      const shells = await detectAvailableShells();

      expect(shells.find((s) => s.path.includes('nonexistent'))).toBeUndefined();
      expect(shells.find((s) => s.path === '/bin/bash')).toBeDefined();
      expect(shells.find((s) => s.path === '/bin/zsh')).toBeDefined();
    });

    it('should fall back to common paths when /etc/shells is unavailable', async () => {
      mockFsReadFile = async () => {
        throw new Error('ENOENT');
      };
      mockFsAccess = async (path) => {
        // Only bash exists
        if (String(path) === '/bin/bash') {
          return undefined;
        }
        throw new Error('ENOENT');
      };

      vi.resetModules();
      const { detectAvailableShells } = await import('./shellDetector');
      const shells = await detectAvailableShells();

      expect(shells.find((s) => s.path === '/bin/bash')).toBeDefined();
    });

    it('should assign correct icons for Unix shells', async () => {
      const etcShells = `/bin/bash
/bin/zsh
/usr/bin/fish
/bin/sh
/bin/dash
/bin/ksh
`;

      mockFsReadFile = async () => etcShells;
      mockFsAccess = async () => undefined;

      vi.resetModules();
      const { detectAvailableShells } = await import('./shellDetector');
      const shells = await detectAvailableShells();

      expect(shells.find((s) => s.path === '/bin/bash')?.icon).toBe('bash');
      expect(shells.find((s) => s.path === '/bin/zsh')?.icon).toBe('zsh');
      expect(shells.find((s) => s.path === '/usr/bin/fish')?.icon).toBe('fish');
      expect(shells.find((s) => s.path === '/bin/sh')?.icon).toBe('bash'); // sh uses bash icon
      expect(shells.find((s) => s.path === '/bin/dash')?.icon).toBe('bash'); // dash uses bash icon
      expect(shells.find((s) => s.path === '/bin/ksh')?.icon).toBe('bash'); // ksh uses bash icon
    });
  });

  describe('detectAvailableShells (macOS)', () => {
    beforeEach(() => {
      setPlatform('darwin');
    });

    it('should detect shells on macOS', async () => {
      const etcShells = `/bin/bash
/bin/sh
/bin/zsh
/usr/local/bin/fish
`;

      mockFsReadFile = async () => etcShells;
      mockFsAccess = async () => undefined;

      vi.resetModules();
      const { detectAvailableShells } = await import('./shellDetector');
      const shells = await detectAvailableShells();

      expect(shells.length).toBeGreaterThan(0);
      expect(shells.find((s) => s.name === 'Zsh')).toBeDefined();
      expect(shells.find((s) => s.name === 'Bash')).toBeDefined();
    });
  });

  describe('ShellInfo structure', () => {
    beforeEach(() => {
      setPlatform('linux');
    });

    it('should return ShellInfo objects with all required fields', async () => {
      const etcShells = `/bin/bash
`;

      mockFsReadFile = async () => etcShells;
      mockFsAccess = async () => undefined;

      vi.resetModules();
      const { detectAvailableShells } = await import('./shellDetector');
      const shells = await detectAvailableShells();

      expect(shells.length).toBe(1);

      const shell = shells[0];
      expect(shell).toHaveProperty('id');
      expect(shell).toHaveProperty('name');
      expect(shell).toHaveProperty('path');
      expect(shell).toHaveProperty('icon');

      expect(typeof shell.id).toBe('string');
      expect(typeof shell.name).toBe('string');
      expect(typeof shell.path).toBe('string');
      expect(typeof shell.icon).toBe('string');
    });

    it('should include args field for WSL shells', async () => {
      setPlatform('win32');
      process.env.SystemRoot = 'C:\\Windows';

      mockExecAsync = async (cmd) => {
        if (cmd.includes('wsl --list')) {
          const output = 'Ubuntu\r\n';
          const buffer = Buffer.from(output, 'utf16le');
          return { stdout: buffer, stderr: '' };
        }
        throw new Error('Not found');
      };

      mockFsAccess = async (path) => {
        if (String(path).includes('wsl.exe')) {
          return undefined;
        }
        throw new Error('ENOENT');
      };

      vi.resetModules();
      const { detectAvailableShells } = await import('./shellDetector');
      const shells = await detectAvailableShells();

      const wslShell = shells.find((s) => s.id === 'wsl-ubuntu');
      expect(wslShell).toBeDefined();
      expect(wslShell?.args).toEqual(['-d', 'Ubuntu']);
    });
  });

  describe('validateShellPath', () => {
    describe('on Unix systems', () => {
      beforeEach(() => {
        setPlatform('linux');
      });

      it('should reject empty paths', async () => {
        vi.resetModules();
        const { validateShellPath } = await import('./shellDetector');

        const result = await validateShellPath('');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Shell path cannot be empty');
      });

      it('should reject whitespace-only paths', async () => {
        vi.resetModules();
        const { validateShellPath } = await import('./shellDetector');

        const result = await validateShellPath('   ');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Shell path cannot be empty');
      });

      it('should reject non-existent paths', async () => {
        mockFsStat = async () => {
          const error = new Error('ENOENT') as NodeJS.ErrnoException;
          error.code = 'ENOENT';
          throw error;
        };

        vi.resetModules();
        const { validateShellPath } = await import('./shellDetector');

        const result = await validateShellPath('/bin/nonexistent');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Shell not found at specified path');
      });

      it('should reject directories', async () => {
        mockFsStat = async () => ({
          isDirectory: () => true,
        });

        vi.resetModules();
        const { validateShellPath } = await import('./shellDetector');

        const result = await validateShellPath('/bin');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Path points to a directory, not a file');
      });

      it('should reject non-executable files', async () => {
        mockFsStat = async () => ({
          isDirectory: () => false,
        });
        mockFsAccess = async (_path, mode) => {
          // Reject executable check (mode = X_OK = 1)
          if (mode === 1) {
            throw new Error('EACCES');
          }
          return undefined;
        };

        vi.resetModules();
        const { validateShellPath } = await import('./shellDetector');

        const result = await validateShellPath('/home/user/script.sh');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('File exists but is not executable');
      });

      it('should accept valid executable files', async () => {
        mockFsStat = async () => ({
          isDirectory: () => false,
        });
        mockFsAccess = async () => undefined;

        vi.resetModules();
        const { validateShellPath } = await import('./shellDetector');

        const result = await validateShellPath('/bin/bash');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    describe('on Windows', () => {
      beforeEach(() => {
        setPlatform('win32');
      });

      it('should reject files without executable extensions', async () => {
        mockFsStat = async () => ({
          isDirectory: () => false,
        });

        vi.resetModules();
        const { validateShellPath } = await import('./shellDetector');

        const result = await validateShellPath('C:\\Program Files\\myshell.txt');
        expect(result.valid).toBe(false);
        expect(result.error).toBe(
          'File does not have an executable extension (.exe, .cmd, .bat, .com)'
        );
      });

      it('should accept .exe files', async () => {
        mockFsStat = async () => ({
          isDirectory: () => false,
        });

        vi.resetModules();
        const { validateShellPath } = await import('./shellDetector');

        const result = await validateShellPath('C:\\Windows\\System32\\cmd.exe');
        expect(result.valid).toBe(true);
      });

      it('should accept .cmd files', async () => {
        mockFsStat = async () => ({
          isDirectory: () => false,
        });

        vi.resetModules();
        const { validateShellPath } = await import('./shellDetector');

        const result = await validateShellPath('C:\\scripts\\myscript.cmd');
        expect(result.valid).toBe(true);
      });

      it('should accept .bat files', async () => {
        mockFsStat = async () => ({
          isDirectory: () => false,
        });

        vi.resetModules();
        const { validateShellPath } = await import('./shellDetector');

        const result = await validateShellPath('C:\\scripts\\myscript.bat');
        expect(result.valid).toBe(true);
      });

      it('should accept .com files', async () => {
        mockFsStat = async () => ({
          isDirectory: () => false,
        });

        vi.resetModules();
        const { validateShellPath } = await import('./shellDetector');

        const result = await validateShellPath('C:\\DOS\\command.com');
        expect(result.valid).toBe(true);
      });

      it('should handle case-insensitive extensions', async () => {
        mockFsStat = async () => ({
          isDirectory: () => false,
        });

        vi.resetModules();
        const { validateShellPath } = await import('./shellDetector');

        const result = await validateShellPath('C:\\Windows\\System32\\cmd.EXE');
        expect(result.valid).toBe(true);
      });

      it('should reject non-existent paths', async () => {
        mockFsStat = async () => {
          const error = new Error('ENOENT') as NodeJS.ErrnoException;
          error.code = 'ENOENT';
          throw error;
        };

        vi.resetModules();
        const { validateShellPath } = await import('./shellDetector');

        const result = await validateShellPath('C:\\nonexistent\\shell.exe');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Shell not found at specified path');
      });

      it('should reject directories', async () => {
        mockFsStat = async () => ({
          isDirectory: () => true,
        });

        vi.resetModules();
        const { validateShellPath } = await import('./shellDetector');

        const result = await validateShellPath('C:\\Windows\\System32');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Path points to a directory, not a file');
      });
    });

    describe('error handling', () => {
      beforeEach(() => {
        setPlatform('linux');
      });

      it('should handle unexpected errors gracefully', async () => {
        mockFsStat = async () => {
          throw new Error('Unexpected error');
        };

        vi.resetModules();
        const { validateShellPath } = await import('./shellDetector');

        const result = await validateShellPath('/bin/bash');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Unable to validate shell path');
      });
    });
  });
});
