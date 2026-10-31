/**
 * Utilitário para validação de CPF brasileiro
 * Implementa verificação completa dos dígitos verificadores
 */

/**
 * Remove caracteres não numéricos do CPF
 */
export function cleanCPF(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

/**
 * Formata CPF para exibição (000.000.000-00)
 */
export function formatCPF(cpf: string): string {
  const numbers = cleanCPF(cpf);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
}

/**
 * Valida se o CPF é válido usando o algoritmo oficial
 * Verifica:
 * 1. Se tem 11 dígitos
 * 2. Se não é uma sequência repetida (ex: 111.111.111-11)
 * 3. Se os dígitos verificadores estão corretos
 */
export function validateCPF(cpf: string): { valid: boolean; message: string } {
  const numbers = cleanCPF(cpf);
  
  // Verifica se tem 11 dígitos
  if (numbers.length !== 11) {
    return { valid: false, message: "CPF deve ter 11 dígitos" };
  }
  
  // Verifica se não é uma sequência repetida (ex: 111.111.111-11)
  const invalidSequences = [
    "00000000000",
    "11111111111",
    "22222222222",
    "33333333333",
    "44444444444",
    "55555555555",
    "66666666666",
    "77777777777",
    "88888888888",
    "99999999999",
  ];
  
  if (invalidSequences.includes(numbers)) {
    return { valid: false, message: "CPF inválido (sequência repetida)" };
  }
  
  // Calcula o primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  
  if (remainder !== parseInt(numbers[9])) {
    return { valid: false, message: "CPF inválido (primeiro dígito verificador incorreto)" };
  }
  
  // Calcula o segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  
  if (remainder !== parseInt(numbers[10])) {
    return { valid: false, message: "CPF inválido (segundo dígito verificador incorreto)" };
  }
  
  return { valid: true, message: "CPF válido" };
}

/**
 * Verifica se o CPF é válido (retorna apenas boolean)
 */
export function isValidCPF(cpf: string): boolean {
  return validateCPF(cpf).valid;
}
