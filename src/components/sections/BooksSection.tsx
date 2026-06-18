import { SectionWrapper } from '../ui/SectionWrapper';
import { GradientText } from '../ui/GradientText';
import { getBooks } from '@/lib/data/content';
import type { Book } from '@portfolio/shared';

const STATUS_LABELS: Record<string, string> = {
  reading: 'Reading',
  completed: 'Completed',
  want_to_read: 'Want to Read',
  paused: 'Paused',
};

const STATUS_COLORS: Record<string, string> = {
  reading: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  completed: 'bg-green-500/10 text-green-400 border-green-500/20',
  want_to_read: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  paused: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

export async function BooksSection() {
  const books = await getBooks();

  if (books.length === 0) return null;

  const reading = books.filter((b) => b.status === 'reading');
  const completed = books.filter((b) => b.status === 'completed');
  const wantToRead = books.filter((b) => b.status === 'want_to_read');

  return (
    <SectionWrapper id="books">
      <div className="text-center mb-8 sm:mb-12">
        <span className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 bg-red-500/10 text-red-400 rounded-full text-xs sm:text-sm font-medium mb-3 sm:mb-4">
          Reading
        </span>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4">
          My <GradientText>Library</GradientText>
        </h2>
        <p className="text-zinc-400 text-sm sm:text-base max-w-xl mx-auto">
          Books I&apos;m reading, have read, and want to read
        </p>
      </div>

      {/* Stats row */}
      <div className="flex justify-center gap-6 sm:gap-10 mb-10 text-center">
        <div>
          <p className="text-2xl font-bold text-white">{books.length}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Total</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-blue-400">{reading.length}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Reading</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-green-400">{completed.length}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Completed</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-yellow-400">{wantToRead.length}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Want to Read</p>
        </div>
      </div>

      {/* Currently reading — highlighted */}
      {reading.length > 0 && (
        <div className="mb-10">
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-widest mb-4">Currently Reading</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {reading.map((book) => (
              <BookCard key={book.id} book={book} highlight />
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="mb-10">
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-widest mb-4">Completed</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {completed.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        </div>
      )}

      {/* Want to read */}
      {wantToRead.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-widest mb-4">Want to Read</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {wantToRead.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        </div>
      )}
    </SectionWrapper>
  );
}

function BookCard({ book, highlight = false }: { book: Book; highlight?: boolean }) {
  return (
    <div className={`flex gap-4 rounded-xl border p-4 transition-colors ${
      highlight
        ? 'bg-zinc-800/60 border-zinc-600 hover:border-zinc-500'
        : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
    }`}>
      {/* Cover */}
      <div className={`flex-shrink-0 rounded-lg overflow-hidden bg-zinc-800 flex items-center justify-center ${highlight ? 'w-20 h-28' : 'w-14 h-20'}`}>
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <svg className="w-7 h-7 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col min-w-0 flex-1">
        <span className={`self-start text-[10px] font-medium px-1.5 py-0.5 rounded border mb-2 ${STATUS_COLORS[book.status] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
          {STATUS_LABELS[book.status] ?? book.status}
        </span>
        <h4 className="font-semibold text-white text-sm leading-snug line-clamp-2 mb-1">{book.title}</h4>
        <p className="text-xs text-zinc-400 mb-2">{book.author}</p>

        {book.rating !== null && (
          <p className="text-yellow-400 text-xs mb-2">{'★'.repeat(book.rating)}{'☆'.repeat(5 - book.rating)}</p>
        )}

        {book.status === 'reading' && (
          <div className="mt-auto">
            <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
              <span>Progress</span>
              <span>{book.progress}%</span>
            </div>
            <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full" style={{ width: `${book.progress}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
