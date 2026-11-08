import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { scryptSync, randomBytes } from 'node:crypto';
import { demoPrograms } from '../server/demo.js';

const password = process.env.SEED_DEMO_PASSWORD;
if (!password || password.length < 10) throw new Error('Set SEED_DEMO_PASSWORD (10+ characters) to opt into fictional seed accounts.');
const prisma = new PrismaClient();
const salt = randomBytes(16).toString('hex');
const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
async function main() {
  const coach = await prisma.user.upsert({ where: { email: 'coach@demo.local' }, update: {}, create: { email: 'coach@demo.local', name: 'Alex Morgan', role: 'COACH', passwordHash } });
  const client = await prisma.user.upsert({ where: { email: 'sam@demo.local' }, update: {}, create: { email: 'sam@demo.local', name: 'Sam Rivera', role: 'CLIENT', coachId: coach.id, goal: 'STRENGTH', passwordHash } });
  if (!await prisma.program.findFirst({ where: { coachId: coach.id, name: 'Strength foundations' } })) await prisma.program.create({ data: { coachId: coach.id, clientId: client.id, name: 'Strength foundations', description: 'Fictional seed plan', status: 'ASSIGNED', content: demoPrograms[0].content as object } });
  console.log('Fictional seed accounts created. Emails: coach@demo.local, sam@demo.local.');
}
main().finally(() => prisma.$disconnect());
