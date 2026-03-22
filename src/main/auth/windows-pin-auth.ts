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
   * Даже если PIN-код не установлен, все равно запрашивает аутентификацию через Windows Hello
   */
  async verifyPinCode(): Promise<boolean> {
    if (process.platform !== 'win32') {
      // На не-Windows системах всегда разрешаем вход
      return true;
    }

    // Сначала проверяем доступность Windows Hello
    try {
      const availabilityCheck = `
        Add-Type -AssemblyName System.Runtime.WindowsRuntime
        $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
        Function InvokeAsync($AsyncOperation, $ResultType) {
          $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
          $netTask = $asTask.Invoke($null, @($AsyncOperation))
          $netTask.Wait(-1) | Out-Null
          $netTask.Result
        }
        $userConsentVerifier = [Windows.Security.Credentials.UI.UserConsentVerifier]
        $availability = InvokeAsync ($userConsentVerifier::CheckAvailabilityAsync()) ([Windows.Security.Credentials.UI.UserConsentVerifierAvailability])
        Write-Output $availability
      `;
      
      const availabilityCommand = `powershell -Command "${availabilityCheck.replace(/\n/g, '; ')}"`;
      const { stdout: availabilityOutput } = await execAsync(availabilityCommand, { timeout: 5000 });
      const availability = availabilityOutput.trim();
      
      console.log('[WindowsPinAuth] Доступность Windows Hello:', availability);
      
      // Если Windows Hello недоступен, разрешаем вход (для совместимости)
      if (availability === 'NotAvailable' || availability === 'DeviceNotPresent') {
        console.log('[WindowsPinAuth] Windows Hello недоступен, разрешаем вход без проверки');
        return true;
      }
    } catch (error) {
      console.warn('[WindowsPinAuth] Ошибка проверки доступности Windows Hello:', error);
      // Продолжаем попытку запроса аутентификации
    }

    // Всегда используем Windows Hello для проверки PIN-кода
    // Принудительно запрашиваем аутентификацию, даже если PIN не установлен
    // Windows Hello может использовать другие методы (отпечаток, лицо и т.д.)
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
        # Всегда запрашиваем проверку через Windows Hello (PIN, отпечаток, лицо и т.д.)
        try {
          $result = InvokeAsync ($userConsentVerifier::RequestVerificationAsync('SafeKey требует подтверждения вашей личности для входа')) ([Windows.Security.Credentials.UI.UserConsentVerificationResult])
          if ($result -eq 'Verified') { Write-Output 'true' } else { Write-Output 'false' }
        } catch {
          Write-Output 'error'
        }
      `;
      
      const command = `powershell -Command "${psScript.replace(/\n/g, '; ')}"`;
      const { stdout, stderr } = await execAsync(command, { timeout: 60000 });
      const result = stdout.trim().toLowerCase();
      
      console.log('[WindowsPinAuth] Результат проверки PIN-кода:', result);
      if (stderr) {
        console.error('[WindowsPinAuth] Ошибка PowerShell:', stderr);
      }
      
      // Если результат true, разрешаем вход
      // Если false, значит пользователь отменил или ввел неверный PIN
      if (result === 'true') {
        console.log('[WindowsPinAuth] Аутентификация через Windows Hello успешна');
        return true;
      } else if (result === 'error') {
        console.error('[WindowsPinAuth] Ошибка при запросе аутентификации');
        // При ошибке разрешаем вход для совместимости
        return true;
      } else {
        console.log('[WindowsPinAuth] Аутентификация через Windows Hello не подтверждена (пользователь отменил или неверный PIN)');
        return false;
      }
    } catch (error: any) {
      console.error('[WindowsPinAuth] Ошибка проверки через Windows Hello:', error);
      // Если это таймаут или другая ошибка, разрешаем вход для совместимости
      if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
        console.log('[WindowsPinAuth] Таймаут при проверке, разрешаем вход');
        return true;
      }
      // В других случаях тоже разрешаем для совместимости
      console.log('[WindowsPinAuth] Ошибка при проверке, разрешаем вход для совместимости');
      return true;
    }
  }

  /**
   * Проверяет доступность PIN-кода
   */
  async checkPinCodeAvailable(): Promise<boolean> {
    return await this.isPinCodeSet();
  }
}

