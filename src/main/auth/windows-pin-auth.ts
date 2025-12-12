import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Сервис для проверки PIN-кода Windows через Windows Hello
 */
export class WindowsPinAuthService {
  /**
   * Проверяет, установлен ли PIN-код на системе Windows
   */
  async isPinCodeSet(): Promise<boolean> {
    if (process.platform !== 'win32') {
      return false;
    }

    try {
      // Проверяем наличие PIN-кода через PowerShell и WMI
      // Используем более надежный способ проверки через Windows.Security.Credentials
      const command = `powershell -Command "try { $pin = Get-CimInstance -Namespace 'root\\Microsoft\\Windows\\Security' -ClassName 'MSFT_PinComplexity' -ErrorAction SilentlyContinue; if ($pin) { Write-Output 'true' } else { Write-Output 'false' } } catch { Write-Output 'false' }"`;
      
      const { stdout } = await execAsync(command);
      const result = stdout.trim().toLowerCase();
      
      if (result === 'true') {
        return true;
      }

      // Альтернативный способ - проверка через реестр
      try {
        const regCommand = `reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Authentication\\LogonUI" /v "PinSet" 2>nul`;
        const { stdout: regOutput } = await execAsync(regCommand);
        return regOutput.length > 0;
      } catch {
        // Если не нашли в реестре, пробуем через проверку наличия Windows Hello
        try {
          const helloCheck = `powershell -Command "try { Add-Type -AssemblyName System.Runtime.WindowsRuntime; $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]; $asTask = $asTaskGeneric.MakeGenericMethod([Windows.Security.Credentials.UI.UserConsentVerificationResult]); $userConsentVerifier = [Windows.Security.Credentials.UI.UserConsentVerifier]; $result = $userConsentVerifier::CheckAvailabilityAsync(); $task = $asTask.Invoke($null, @($result)); $task.Result; } catch { Write-Output 'NotAvailable' }"`;
          const { stdout: helloOutput } = await execAsync(helloCheck);
          // Если Windows Hello доступен, вероятно PIN установлен
          return !helloOutput.includes('NotAvailable');
        } catch {
          return false;
        }
      }
    } catch (error) {
      console.log('[WindowsPinAuth] Не удалось проверить наличие PIN-кода:', error);
      return false;
    }
  }

  /**
   * Проверяет PIN-код через Windows Hello
   * Всегда запрашивает PIN-код, даже если пользователь уже в системе
   */
  async verifyPinCode(): Promise<boolean> {
    if (process.platform !== 'win32') {
      // На не-Windows системах всегда разрешаем вход
      return true;
    }

    const pinSet = await this.isPinCodeSet();
    
    if (!pinSet) {
      // Если PIN не установлен, разрешаем вход без пароля
      console.log('[WindowsPinAuth] PIN-код не установлен, разрешаем вход без пароля');
      return true;
    }

    // Всегда используем Windows Hello для проверки PIN-кода
    // Принудительно запрашиваем PIN-код, даже если пользователь уже в системе
    try {
      // Используем Windows Hello API через PowerShell
      // RequestVerificationAsync должен показывать диалог
      const psScript = `
        Add-Type -AssemblyName System.Runtime.WindowsRuntime
        $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
        Function InvokeAsync($AsyncOperation, $ResultType) {
          $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
          $netTask = $asTask.Invoke($null, @($AsyncOperation))
          $netTask.Wait(-1) | Out-Null
          $netTask.Result
        }
        $userConsentVerifier = [Windows.Security.Credentials.UI.UserConsentVerifier]
        # Всегда запрашиваем проверку PIN-кода
        $result = InvokeAsync ($userConsentVerifier::RequestVerificationAsync('SafeKey требует подтверждения вашего PIN-кода для входа')) ([Windows.Security.Credentials.UI.UserConsentVerificationResult])
        if ($result -eq 'Verified') { Write-Output 'true' } else { Write-Output 'false' }
      `;
      
      const command = `powershell -Command "${psScript.replace(/\n/g, '; ')}"`;
      const { stdout } = await execAsync(command);
      const result = stdout.trim().toLowerCase();
      
      // Если результат true, разрешаем вход
      // Если false, значит пользователь отменил или ввел неверный PIN
      return result === 'true';
    } catch (error) {
      console.error('[WindowsPinAuth] Ошибка проверки PIN-кода:', error);
      // В случае ошибки возвращаем false для безопасности
      return false;
    }
  }

  /**
   * Проверяет доступность PIN-кода
   */
  async checkPinCodeAvailable(): Promise<boolean> {
    return await this.isPinCodeSet();
  }
}

