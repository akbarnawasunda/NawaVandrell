#!/bin/bash
SLUG=$1
if [ -z "$SLUG" ]; then 
  echo "Usage: bash scripts/add-quiz-door.sh [slug-kategori]"
  echo "Contoh: bash scripts/add-quiz-door.sh asahotak"
  exit 1
fi

mkdir -p "app/games/$SLUG"
cat > "app/games/$SLUG/page.js" << EOF
'use client';
import QuizEngine from '@/components/QuizEngine';
export default function Page() {
  return <QuizEngine cat="$SLUG" />;
}
EOF
echo "Pintu buat $SLUG udah dibikin di app/games/$SLUG/page.js"
