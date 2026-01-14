/**
 * Script para criar o usuário administrador
 * Execute com: npx tsx scripts/setup-admin.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import * as readline from 'readline';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('\n🔐 Setup do Administrador do Portfolio\n');
  console.log('=====================================\n');

  // Check if admin already exists
  const existingUser = await prisma.user.findFirst();
  if (existingUser) {
    console.log('⚠️  Já existe um usuário cadastrado!');
    console.log(`   Email: ${existingUser.email}`);
    console.log(`   Nome: ${existingUser.name}`);

    const update = await question('\nDeseja atualizar a senha? (s/n): ');
    if (update.toLowerCase() === 's') {
      const newPassword = await question('Nova senha (mínimo 8 caracteres): ');
      if (newPassword.length < 8) {
        console.log('❌ Senha muito curta. Abortando.');
        process.exit(1);
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { passwordHash },
      });

      console.log('\n✅ Senha atualizada com sucesso!');
    }

    rl.close();
    await pool.end();
    process.exit(0);
  }

  // Collect admin info
  const name = await question('Seu nome: ');
  const email = await question('Seu email: ');
  const password = await question('Senha (mínimo 8 caracteres): ');

  // Validate
  if (!name || name.length < 2) {
    console.log('❌ Nome inválido');
    process.exit(1);
  }

  if (!email || !email.includes('@')) {
    console.log('❌ Email inválido');
    process.exit(1);
  }

  if (!password || password.length < 8) {
    console.log('❌ Senha deve ter pelo menos 8 caracteres');
    process.exit(1);
  }

  // Create user
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      passwordHash,
    },
  });

  console.log('\n✅ Administrador criado com sucesso!');
  console.log(`   ID: ${user.id}`);
  console.log(`   Nome: ${user.name}`);
  console.log(`   Email: ${user.email}`);
  console.log('\n🔒 Guarde sua senha em local seguro!');
  console.log('📧 Você receberá um código por email a cada login.\n');

  rl.close();
  await pool.end();
}

main().catch(async (e) => {
  console.error('Erro:', e);
  await pool.end();
  process.exit(1);
});
