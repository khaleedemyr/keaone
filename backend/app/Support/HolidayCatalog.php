<?php

namespace App\Support;

class HolidayCatalog
{
    /**
     * SKB 3 Menteri 2026 plus daftar 2025/2027.
     *
     * @return list<array{date: string, kind: string, name_id: string, name_en: string}>
     */
    public static function forYear(int $year): array
    {
        $byDate = [];
        foreach (self::fixed($year) as $row) {
            $byDate[$row['date']] = $row;
        }
        foreach (self::YEARS[$year] ?? [] as $row) {
            $byDate[$row['date']] = $row;
        }

        $items = array_values($byDate);
        usort($items, fn (array $a, array $b) => $a['date'] <=> $b['date']);

        return $items;
    }

    /**
     * @return list<array{date: string, kind: string, name_id: string, name_en: string}>
     */
    private static function fixed(int $year): array
    {
        return [
            self::row("$year-01-01", 'national', 'Tahun Baru Masehi', "New Year's Day"),
            self::row("$year-05-01", 'national', 'Hari Buruh Internasional', 'International Labour Day'),
            self::row("$year-06-01", 'national', 'Hari Lahir Pancasila', 'Pancasila Day'),
            self::row("$year-08-17", 'national', 'Hari Kemerdekaan', 'Independence Day'),
            self::row("$year-12-25", 'national', 'Hari Natal', 'Christmas Day'),
        ];
    }

    /**
     * @var array<int, list<array{date: string, kind: string, name_id: string, name_en: string}>>
     */
    private const YEARS = [
        2025 => [
            ['date' => '2025-01-27', 'kind' => 'national', 'name_id' => 'Isra Mikraj Nabi Muhammad SAW', 'name_en' => 'Isra and Mi\'raj'],
            ['date' => '2025-01-28', 'kind' => 'joint', 'name_id' => 'Cuti bersama Imlek', 'name_en' => 'Chinese New Year joint holiday'],
            ['date' => '2025-01-29', 'kind' => 'national', 'name_id' => 'Tahun Baru Imlek 2576', 'name_en' => 'Chinese New Year'],
            ['date' => '2025-03-28', 'kind' => 'joint', 'name_id' => 'Cuti bersama Nyepi', 'name_en' => 'Nyepi joint holiday'],
            ['date' => '2025-03-29', 'kind' => 'national', 'name_id' => 'Hari Suci Nyepi', 'name_en' => 'Nyepi'],
            ['date' => '2025-03-31', 'kind' => 'national', 'name_id' => 'Idul Fitri 1446 H', 'name_en' => 'Eid al-Fitr'],
            ['date' => '2025-04-01', 'kind' => 'national', 'name_id' => 'Idul Fitri 1446 H', 'name_en' => 'Eid al-Fitr'],
            ['date' => '2025-04-02', 'kind' => 'joint', 'name_id' => 'Cuti bersama Idul Fitri', 'name_en' => 'Eid al-Fitr joint holiday'],
            ['date' => '2025-04-03', 'kind' => 'joint', 'name_id' => 'Cuti bersama Idul Fitri', 'name_en' => 'Eid al-Fitr joint holiday'],
            ['date' => '2025-04-04', 'kind' => 'joint', 'name_id' => 'Cuti bersama Idul Fitri', 'name_en' => 'Eid al-Fitr joint holiday'],
            ['date' => '2025-04-07', 'kind' => 'joint', 'name_id' => 'Cuti bersama Idul Fitri', 'name_en' => 'Eid al-Fitr joint holiday'],
            ['date' => '2025-04-18', 'kind' => 'national', 'name_id' => 'Wafat Yesus Kristus', 'name_en' => 'Good Friday'],
            ['date' => '2025-04-20', 'kind' => 'national', 'name_id' => 'Kebangkitan Yesus Kristus (Paskah)', 'name_en' => 'Easter Sunday'],
            ['date' => '2025-05-12', 'kind' => 'national', 'name_id' => 'Hari Raya Waisak', 'name_en' => 'Vesak Day'],
            ['date' => '2025-05-13', 'kind' => 'joint', 'name_id' => 'Cuti bersama Waisak', 'name_en' => 'Vesak joint holiday'],
            ['date' => '2025-05-29', 'kind' => 'national', 'name_id' => 'Kenaikan Yesus Kristus', 'name_en' => 'Ascension Day'],
            ['date' => '2025-05-30', 'kind' => 'joint', 'name_id' => 'Cuti bersama Kenaikan Yesus Kristus', 'name_en' => 'Ascension joint holiday'],
            ['date' => '2025-06-06', 'kind' => 'national', 'name_id' => 'Idul Adha 1446 H', 'name_en' => 'Eid al-Adha'],
            ['date' => '2025-06-09', 'kind' => 'joint', 'name_id' => 'Cuti bersama Idul Adha', 'name_en' => 'Eid al-Adha joint holiday'],
            ['date' => '2025-06-27', 'kind' => 'national', 'name_id' => '1 Muharam Tahun Baru Islam 1447 H', 'name_en' => 'Islamic New Year'],
            ['date' => '2025-09-05', 'kind' => 'national', 'name_id' => 'Maulid Nabi Muhammad SAW', 'name_en' => 'Prophet Muhammad\'s Birthday'],
        ],
        2026 => [
            ['date' => '2026-01-16', 'kind' => 'national', 'name_id' => 'Isra Mikraj Nabi Muhammad SAW', 'name_en' => 'Isra and Mi\'raj'],
            ['date' => '2026-02-16', 'kind' => 'joint', 'name_id' => 'Cuti bersama Imlek', 'name_en' => 'Chinese New Year joint holiday'],
            ['date' => '2026-02-17', 'kind' => 'national', 'name_id' => 'Tahun Baru Imlek 2577 Kongzili', 'name_en' => 'Chinese New Year'],
            ['date' => '2026-03-18', 'kind' => 'joint', 'name_id' => 'Cuti bersama Nyepi', 'name_en' => 'Nyepi joint holiday'],
            ['date' => '2026-03-19', 'kind' => 'national', 'name_id' => 'Hari Suci Nyepi (Tahun Baru Saka 1948)', 'name_en' => 'Nyepi'],
            ['date' => '2026-03-20', 'kind' => 'joint', 'name_id' => 'Cuti bersama Idul Fitri', 'name_en' => 'Eid al-Fitr joint holiday'],
            ['date' => '2026-03-21', 'kind' => 'national', 'name_id' => 'Idul Fitri 1447 H', 'name_en' => 'Eid al-Fitr'],
            ['date' => '2026-03-22', 'kind' => 'national', 'name_id' => 'Idul Fitri 1447 H', 'name_en' => 'Eid al-Fitr'],
            ['date' => '2026-03-23', 'kind' => 'joint', 'name_id' => 'Cuti bersama Idul Fitri', 'name_en' => 'Eid al-Fitr joint holiday'],
            ['date' => '2026-03-24', 'kind' => 'joint', 'name_id' => 'Cuti bersama Idul Fitri', 'name_en' => 'Eid al-Fitr joint holiday'],
            ['date' => '2026-04-03', 'kind' => 'national', 'name_id' => 'Wafat Yesus Kristus', 'name_en' => 'Good Friday'],
            ['date' => '2026-04-05', 'kind' => 'national', 'name_id' => 'Kebangkitan Yesus Kristus (Paskah)', 'name_en' => 'Easter Sunday'],
            ['date' => '2026-05-14', 'kind' => 'national', 'name_id' => 'Kenaikan Yesus Kristus', 'name_en' => 'Ascension Day'],
            ['date' => '2026-05-15', 'kind' => 'joint', 'name_id' => 'Cuti bersama Kenaikan Yesus Kristus', 'name_en' => 'Ascension joint holiday'],
            ['date' => '2026-05-27', 'kind' => 'national', 'name_id' => 'Idul Adha 1447 H', 'name_en' => 'Eid al-Adha'],
            ['date' => '2026-05-28', 'kind' => 'joint', 'name_id' => 'Cuti bersama Idul Adha', 'name_en' => 'Eid al-Adha joint holiday'],
            ['date' => '2026-05-31', 'kind' => 'national', 'name_id' => 'Hari Raya Waisak 2570 BE', 'name_en' => 'Vesak Day'],
            ['date' => '2026-06-16', 'kind' => 'national', 'name_id' => '1 Muharam Tahun Baru Islam 1448 H', 'name_en' => 'Islamic New Year'],
            ['date' => '2026-08-25', 'kind' => 'national', 'name_id' => 'Maulid Nabi Muhammad SAW', 'name_en' => 'Prophet Muhammad\'s Birthday'],
            ['date' => '2026-12-24', 'kind' => 'joint', 'name_id' => 'Cuti bersama Natal', 'name_en' => 'Christmas joint holiday'],
        ],
        2027 => [
            ['date' => '2027-01-05', 'kind' => 'national', 'name_id' => 'Isra Mikraj Nabi Muhammad SAW', 'name_en' => 'Isra and Mi\'raj'],
            ['date' => '2027-02-06', 'kind' => 'national', 'name_id' => 'Tahun Baru Imlek', 'name_en' => 'Chinese New Year'],
            ['date' => '2027-03-09', 'kind' => 'national', 'name_id' => 'Hari Suci Nyepi', 'name_en' => 'Nyepi'],
            ['date' => '2027-03-10', 'kind' => 'national', 'name_id' => 'Idul Fitri', 'name_en' => 'Eid al-Fitr'],
            ['date' => '2027-03-11', 'kind' => 'joint', 'name_id' => 'Cuti bersama Idul Fitri', 'name_en' => 'Eid al-Fitr joint holiday'],
            ['date' => '2027-03-26', 'kind' => 'national', 'name_id' => 'Wafat Yesus Kristus', 'name_en' => 'Good Friday'],
            ['date' => '2027-05-06', 'kind' => 'national', 'name_id' => 'Kenaikan Yesus Kristus', 'name_en' => 'Ascension Day'],
            ['date' => '2027-05-17', 'kind' => 'national', 'name_id' => 'Idul Adha', 'name_en' => 'Eid al-Adha'],
            ['date' => '2027-05-20', 'kind' => 'national', 'name_id' => 'Hari Raya Waisak', 'name_en' => 'Vesak Day'],
            ['date' => '2027-06-06', 'kind' => 'national', 'name_id' => '1 Muharam Tahun Baru Islam', 'name_en' => 'Islamic New Year'],
            ['date' => '2027-08-15', 'kind' => 'national', 'name_id' => 'Maulid Nabi Muhammad SAW', 'name_en' => 'Prophet Muhammad\'s Birthday'],
        ],
    ];

    /**
     * @return array{date: string, kind: string, name_id: string, name_en: string}
     */
    private static function row(string $date, string $kind, string $nameId, string $nameEn): array
    {
        return [
            'date' => $date,
            'kind' => $kind,
            'name_id' => $nameId,
            'name_en' => $nameEn,
        ];
    }
}
