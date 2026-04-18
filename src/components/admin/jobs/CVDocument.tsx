'use client';

import { Document, Page, View, Text, StyleSheet, Link } from '@react-pdf/renderer';
import { type CustomCVContent } from '@/lib/jobs/cv-generator';

interface PersonalInfo {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
}

interface CVDocumentProps {
  cv: CustomCVContent;
  personalInfo: PersonalInfo;
  jobTitle: string;
  company: string;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1e293b',
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 44,
    lineHeight: 1.5,
  },

  // Header
  header: {
    marginBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: '#0f172a',
    paddingBottom: 10,
  },
  name: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 3,
  },
  contactText: {
    fontSize: 9,
    color: '#475569',
  },
  contactSep: {
    fontSize: 9,
    color: '#cbd5e1',
  },
  targetBadge: {
    marginTop: 5,
    fontSize: 9,
    color: '#3b82f6',
  },

  // Section
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: '#475569',
    borderBottomWidth: 0.75,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 3,
    marginBottom: 7,
  },

  // Summary
  summaryText: {
    fontSize: 10,
    color: '#334155',
    lineHeight: 1.6,
  },

  // Skills
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  skillChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 7,
    fontSize: 9,
    color: '#334155',
  },

  // Experience
  expEntry: {
    marginBottom: 11,
  },
  expHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 1,
  },
  expTitle: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  expDates: {
    fontSize: 9,
    color: '#64748b',
  },
  expCompany: {
    fontSize: 9.5,
    color: '#475569',
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 2,
    paddingLeft: 8,
  },
  bullet: {
    fontSize: 9,
    color: '#334155',
    marginRight: 5,
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
    color: '#334155',
    lineHeight: 1.5,
  },
});

export default function CVDocument({ cv, personalInfo, jobTitle, company }: CVDocumentProps) {
  return (
    <Document
      title={`CV — ${personalInfo.name} — ${jobTitle} @ ${company}`}
      author={personalInfo.name}
      subject={`Tailored CV for ${jobTitle} at ${company}`}
      creator="Portfolio Job Tracker"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name}>{personalInfo.name}</Text>
          <View style={styles.contactRow}>
            <Text style={styles.contactText}>{personalInfo.email}</Text>
            <Text style={styles.contactSep}>·</Text>
            <Text style={styles.contactText}>{personalInfo.phone}</Text>
            <Text style={styles.contactSep}>·</Text>
            <Link src={`https://linkedin.com/in/${personalInfo.linkedin}`} style={styles.contactText}>
              linkedin.com/in/{personalInfo.linkedin}
            </Link>
            <Text style={styles.contactSep}>·</Text>
            <Link src={`https://github.com/${personalInfo.github}`} style={styles.contactText}>
              github.com/{personalInfo.github}
            </Link>
          </View>
          <Text style={styles.targetBadge}>
            Tailored for: {jobTitle} @ {company}
          </Text>
        </View>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Professional Summary</Text>
          <Text style={styles.summaryText}>{cv.summary}</Text>
        </View>

        {/* Skills */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills</Text>
          <View style={styles.skillsGrid}>
            {cv.skills.map((skill, i) => (
              <Text key={i} style={styles.skillChip}>{skill}</Text>
            ))}
          </View>
        </View>

        {/* Experience */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Experience</Text>
          {cv.experience.map((exp, i) => (
            <View key={i} style={styles.expEntry}>
              <View style={styles.expHeader}>
                <Text style={styles.expTitle}>{exp.title}</Text>
                <Text style={styles.expDates}>{exp.startDate} – {exp.endDate}</Text>
              </View>
              <Text style={styles.expCompany}>
                {exp.company}{exp.location ? ` · ${exp.location}` : ''}
              </Text>
              {exp.bullets.map((bullet, j) => (
                <View key={j} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
