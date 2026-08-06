import ExcelJS from 'exceljs'
import path from 'path'

// ── FRESH from Supabase MCP — comp_9b5118c31da8a8a5 (ACTIVE competition) — 2026-08-06 ──
const sessions = [{"participant_code":"0051","name":"เด็กชายชวกร เรืองธุวกุล","nickname":"ภูมิ","school":"พิษณุโลก1","subject":"math","level":3},{"participant_code":"0184","name":"เด็กชายปรเมศวร์ ชินราช","nickname":null,"school":"กุญแจ","subject":"english","level":4},{"participant_code":"0184","name":"เด็กชายปรเมศวร์ ชินราช","nickname":null,"school":"กุญแจ","subject":"math","level":7},{"participant_code":"0200","name":"เด็กหญิงอัยย์ญาดา สวัสดีพุทรา","nickname":"เป่าเป้ย","school":"ละหานทราย","subject":"english","level":2},{"participant_code":"0231","name":"เด็กชายบดีธัช อินทอง","nickname":"บาน่า","school":"เซนโยเซฟ","subject":"english","level":3},{"participant_code":"0231","name":"เด็กชายบดีธัช อินทอง","nickname":"บาน่า","school":"เซนโยเซฟ","subject":"math","level":4},{"participant_code":"0234","name":"เด็กชายรัชชานนท์ พรมบุ","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"0234","name":"เด็กชายรัชชานนท์ พรมบุ","nickname":null,"school":"กุญแจ","subject":"math","level":2},{"participant_code":"0331","name":"เด็กหญิงจัสมินณ์ กอร์ บาวา","nickname":"แจสมี่","school":"พัทยา","subject":"english","level":1},{"participant_code":"0710","name":"Gauravi Gupta","nickname":"กัวลาวี","school":"พัทยา","subject":"english","level":2},{"participant_code":"0710","name":"Gauravi Gupta","nickname":"กัวลาวี","school":"พัทยา","subject":"math","level":2},{"participant_code":"0755","name":"Hassani Farmer","nickname":"ฮาซานิ","school":"พัทยา","subject":"english","level":1},{"participant_code":"0813","name":"เด็กชายปัญญากร จันทเปรมจิตต์","nickname":"อคิล","school":"พัทยา","subject":"english","level":2},{"participant_code":"0883","name":"เด็กหญิงพิณญดา เนตรแสงสี","nickname":"ญาดา","school":"พิษณุโลก5","subject":"math","level":4},{"participant_code":"0936","name":"เด็กหญิงพิมพัชร สินสุขบริรักษ์","nickname":"พิพิม","school":"พัทยา","subject":"english","level":1},{"participant_code":"0946","name":"เด็กหญิงสุภาพร  เพียรงาน","nickname":"ออนิว","school":"พะเยา","subject":"math","level":6},{"participant_code":"1287","name":"เด็กชายธีรภัทร เกียนแก้ง","nickname":"โทนี่","school":"พัทยา","subject":"math","level":2},{"participant_code":"1318","name":"เด็กชายภูมินทร์  กุญชร","nickname":"เนตั้น","school":"หนองไผ่","subject":"english","level":2},{"participant_code":"1318","name":"เด็กชายภูมินทร์  กุญชร","nickname":"เนตั้น","school":"หนองไผ่","subject":"math","level":3},{"participant_code":"1425","name":"เด็กหญิงณัฐกาญจน์ เจริญวงษ์ตระกูล","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"1425","name":"เด็กหญิงณัฐกาญจน์ เจริญวงษ์ตระกูล","nickname":null,"school":"กุญแจ","subject":"math","level":3},{"participant_code":"1590","name":"เด็กหญิงขรินทร์ทิพย์ ชัยชนะ","nickname":"จินนี่","school":"เซนโยเซฟ","subject":"english","level":3},{"participant_code":"1590","name":"เด็กหญิงขรินทร์ทิพย์ ชัยชนะ","nickname":"จินนี่","school":"เซนโยเซฟ","subject":"math","level":4},{"participant_code":"1693","name":"เด็กชายวันฉัตร ดำรุณศร","nickname":null,"school":"กุญแจ","subject":"english","level":4},{"participant_code":"1693","name":"เด็กชายวันฉัตร ดำรุณศร","nickname":null,"school":"กุญแจ","subject":"math","level":8},{"participant_code":"1980","name":"เด็กชายณัฐภูมินทร์  อินทร์ยัง","nickname":"จั้มเปอร์","school":"พิษณุโลก5","subject":"math","level":4},{"participant_code":"1982","name":"เด็กหญิงคุณัญญา ตรุวรรณ์","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"1982","name":"เด็กหญิงคุณัญญา ตรุวรรณ์","nickname":null,"school":"กุญแจ","subject":"math","level":2},{"participant_code":"2067","name":"เด็กหญิงลิลี่ โรส เซลเดอร์ สลากส์","nickname":"โรซี่","school":"พัทยา","subject":"english","level":1},{"participant_code":"2127","name":"เด็กหญิงทักษพร บุตรเชื้อไทย","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"2127","name":"เด็กหญิงทักษพร บุตรเชื้อไทย","nickname":null,"school":"กุญแจ","subject":"math","level":3},{"participant_code":"2134","name":"เด็กหญิงเยริณน์  ปิติทวีวัฒน์","nickname":"Fuyu","school":"พัทยา","subject":"math","level":2},{"participant_code":"2162","name":"เด็กชายภาคิน  แสงเดือน","nickname":"คุณ","school":"พิษณุโลก5","subject":"math","level":8},{"participant_code":"2222","name":"เด็กหญิงวรภัทร บุญใหญ่","nickname":"ต้าเหนิง","school":"พัทยา","subject":"english","level":1},{"participant_code":"2222","name":"เด็กหญิงวรภัทร บุญใหญ่","nickname":"ต้าเหนิง","school":"พัทยา","subject":"math","level":1},{"participant_code":"2282","name":"เด็กหญิงแพรแพรวพรรณ ธีรวัฒนเศรษฐ์","nickname":null,"school":"กุญแจ","subject":"english","level":4},{"participant_code":"2282","name":"เด็กหญิงแพรแพรวพรรณ ธีรวัฒนเศรษฐ์","nickname":null,"school":"กุญแจ","subject":"math","level":6},{"participant_code":"2419","name":"เด็กชายพิชาภัทร ห่อมณีรัตน์","nickname":null,"school":"กุญแจ","subject":"english","level":4},{"participant_code":"2419","name":"เด็กชายพิชาภัทร ห่อมณีรัตน์","nickname":null,"school":"กุญแจ","subject":"math","level":7},{"participant_code":"2491","name":"เด็กหญิงนภัสนันท์ โชคศศิวงศ์กิจ","nickname":null,"school":"กุญแจ","subject":"english","level":4},{"participant_code":"2491","name":"เด็กหญิงนภัสนันท์ โชคศศิวงศ์กิจ","nickname":null,"school":"กุญแจ","subject":"math","level":8},{"participant_code":"2513","name":"เด็กหญิงกัญญาภัทร จันทเปรมจิตต์","nickname":"อันดา","school":"พัทยา","subject":"english","level":3},{"participant_code":"2602","name":"เด็กหญิงพิชญาภา  สายยัง","nickname":"แก้มบุ๋ม","school":"พิษณุโลก5","subject":"math","level":5},{"participant_code":"2739","name":"เด็กหญิงวิศรุตากานต์  สิทธิโชคสถิต","nickname":"ใบบัว","school":"พิษณุโลก5","subject":"math","level":3},{"participant_code":"2758","name":"เด็กชายภัคพงศ์ ขจรกลิ่น","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"2758","name":"เด็กชายภัคพงศ์ ขจรกลิ่น","nickname":null,"school":"กุญแจ","subject":"math","level":2},{"participant_code":"2800","name":"Eric","nickname":"อีริค","school":"พัทยา","subject":"english","level":1},{"participant_code":"2800","name":"Eric","nickname":"อีริค","school":"พัทยา","subject":"math","level":1},{"participant_code":"2845","name":"เด็กหญิงเยริณน์  ปิติทวีวัฒน์","nickname":"Fuyu","school":"พัทยา","subject":"english","level":2},{"participant_code":"2934","name":"เด็กชายวรงกร ลือจิตร","nickname":"เภา","school":"พะเยา","subject":"english","level":3},{"participant_code":"2943","name":"เด็กหญิงชนัญชิดา  โนเปลือย","nickname":null,"school":"กุญแจ","subject":"english","level":3},{"participant_code":"2943","name":"เด็กหญิงชนัญชิดา  โนเปลือย","nickname":null,"school":"กุญแจ","subject":"math","level":5},{"participant_code":"2997","name":"เด็กหญิงจิดาภา นิธิโชติสกุล","nickname":"ซีลิน","school":"พัทยา","subject":"english","level":1},{"participant_code":"3240","name":"ด็กชายอาชาวิน โอรักษ์","nickname":"คุณ","school":"หนองไผ่","subject":"math","level":5},{"participant_code":"3245","name":"เด็กชายณัฐวรรธน์ จันทร์สูง","nickname":"ต้นหนาว","school":"เซนโยเซฟ","subject":"math","level":4},{"participant_code":"3300","name":"เด็กหญิงฉัตรธารา ดนตรีเจริญ","nickname":"ไลลา","school":"พัทยา","subject":"english","level":4},{"participant_code":"3300","name":"เด็กหญิงฉัตรธารา ดนตรีเจริญ","nickname":"ไลลา","school":"พัทยา","subject":"math","level":6},{"participant_code":"3410","name":"เด็กหญิงภัทร์นรินทร์ ธรรมดี","nickname":"จันเจ้า","school":"พัทยา","subject":"english","level":2},{"participant_code":"3410","name":"เด็กหญิงภัทร์นรินทร์ ธรรมดี","nickname":"จันเจ้า","school":"พัทยา","subject":"math","level":3},{"participant_code":"3421","name":"เด็กหญิงวิจิตรา แก้วงาม","nickname":"ไอบุญ","school":"เซนโยเซฟ","subject":"math","level":5},{"participant_code":"3545","name":"เด็กชายศุภกฤต สมัยพัฒนา","nickname":"สตางค์","school":"พัทยา","subject":"math","level":4},{"participant_code":"3628","name":"เด็กชายธีร์ทัศน์ เดิมศรีภูมิ","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"3628","name":"เด็กชายธีร์ทัศน์ เดิมศรีภูมิ","nickname":null,"school":"กุญแจ","subject":"math","level":2},{"participant_code":"3643","name":"เด็กหญิงวชิรญาณ์  ตันเฮียง","nickname":"แก้วตา","school":"หนองไผ่","subject":"english","level":2},{"participant_code":"3643","name":"เด็กหญิงวชิรญาณ์  ตันเฮียง","nickname":"แก้วตา","school":"หนองไผ่","subject":"math","level":3},{"participant_code":"3817","name":"เด็กหญิงสุชัญญา นนทะโคตร","nickname":null,"school":"กุญแจ","subject":"english","level":4},{"participant_code":"3817","name":"เด็กหญิงสุชัญญา นนทะโคตร","nickname":null,"school":"กุญแจ","subject":"math","level":8},{"participant_code":"3952","name":"เด็กชายกิตติคุณ แรมวัลย์","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"3952","name":"เด็กชายกิตติคุณ แรมวัลย์","nickname":null,"school":"กุญแจ","subject":"math","level":2},{"participant_code":"3955","name":"เด็กหญิงโชติกา แจ่มศรีทวีทรัพย์","nickname":null,"school":"กุญแจ","subject":"english","level":4},{"participant_code":"3955","name":"เด็กหญิงโชติกา แจ่มศรีทวีทรัพย์","nickname":null,"school":"กุญแจ","subject":"math","level":6},{"participant_code":"4005","name":"เด็กหญิงวณิชยา ปุยวงค์","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"4005","name":"เด็กหญิงวณิชยา ปุยวงค์","nickname":null,"school":"กุญแจ","subject":"math","level":3},{"participant_code":"4018","name":"เด็กหญิงสุกฤตา เพิ่มพล","nickname":"แฟ้ม","school":"พิษณุโลก1","subject":"english","level":3},{"participant_code":"4040","name":"เด็กหญิงชุติกาญจน์ ภิญโญอนันตพงษ์","nickname":"โอปอล์","school":"เซนโยเซฟ","subject":"english","level":2},{"participant_code":"4040","name":"เด็กหญิงชุติกาญจน์ ภิญโญอนันตพงษ์","nickname":"โอปอล์","school":"เซนโยเซฟ","subject":"math","level":3},{"participant_code":"4201","name":"เด็กหญิงณัฐากาญจน์  ทองดี","nickname":"ทองแพง","school":"เพชรบูรณ์","subject":"english","level":1},{"participant_code":"4232","name":"เด็กชายอัครินทร์ วรัญญานนท์","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"4232","name":"เด็กชายอัครินทร์ วรัญญานนท์","nickname":null,"school":"กุญแจ","subject":"math","level":2},{"participant_code":"4313","name":"เด็กชายปิยวิชญ์  จันทร์แจ้ง","nickname":"เป็นโปรด","school":"พิษณุโลก1","subject":"math","level":6},{"participant_code":"4375","name":"เด็กหญิงศรัณย์รัชต์  พัฒนวรนนท์","nickname":"คริสตัล","school":"เพชรบูรณ์","subject":"english","level":3},{"participant_code":"4383","name":"เด็กหญิงเขมจิรา จารุวาทินกุล","nickname":"อิงอิง","school":"พัทยา","subject":"english","level":2},{"participant_code":"4694","name":"เด็กชายวีรภัทร รอดมณี","nickname":"สดใส","school":"พัทยา","subject":"english","level":3},{"participant_code":"4694","name":"เด็กชายวีรภัทร รอดมณี","nickname":"สดใส","school":"พัทยา","subject":"math","level":4},{"participant_code":"4760","name":"เด็กชายภูบดินทร์ วงษ์กระนวน","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"4760","name":"เด็กชายภูบดินทร์ วงษ์กระนวน","nickname":null,"school":"กุญแจ","subject":"math","level":3},{"participant_code":"4830","name":"เด็กชายธนชิต  วงสกุล","nickname":null,"school":"กุญแจ","subject":"english","level":4},{"participant_code":"4830","name":"เด็กชายธนชิต  วงสกุล","nickname":null,"school":"กุญแจ","subject":"math","level":6},{"participant_code":"4917","name":"เด็กหญิงมาริสา  ภู่อ่ำ","nickname":"มะลิ*","school":"พัทยา","subject":"english","level":1},{"participant_code":"5043","name":"เด็กชายอัศดินทร์ พรมงาม","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"5043","name":"เด็กชายอัศดินทร์ พรมงาม","nickname":null,"school":"กุญแจ","subject":"math","level":3},{"participant_code":"5047","name":"เด็กชายธัชวรรธน์ ฉิมพรัตน์","nickname":"มังกร","school":"เซนโยเซฟ","subject":"english","level":4},{"participant_code":"5047","name":"เด็กชายธัชวรรธน์ ฉิมพรัตน์","nickname":"มังกร","school":"เซนโยเซฟ","subject":"math","level":6},{"participant_code":"5050","name":"เด็กชายภูมิพัฒน์ แจ่มศรี","nickname":null,"school":"กุญแจ","subject":"english","level":3},{"participant_code":"5050","name":"เด็กชายภูมิพัฒน์ แจ่มศรี","nickname":null,"school":"กุญแจ","subject":"math","level":5},{"participant_code":"5114","name":"เด็กหญิงธันยารัตน์  แสงสุธา","nickname":"ปุ๋ย","school":"เซนโยเซฟ","subject":"english","level":4},{"participant_code":"5114","name":"เด็กหญิงธันยารัตน์  แสงสุธา","nickname":"ปุ๋ย","school":"เซนโยเซฟ","subject":"math","level":6},{"participant_code":"5388","name":"เด็กชายพชร เจริญสุข","nickname":"ตุนท์","school":"พัทยา","subject":"english","level":2},{"participant_code":"5616","name":"เด็กหญิงพรปวีณ์ จำปาบัว","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"5616","name":"เด็กหญิงพรปวีณ์ จำปาบัว","nickname":null,"school":"กุญแจ","subject":"math","level":3},{"participant_code":"5657","name":"เด็กชายพฤษภัสส์ เตยแก้ว","nickname":"พฤกษ์","school":"พัทยา","subject":"english","level":2},{"participant_code":"5657","name":"เด็กชายพฤษภัสส์ เตยแก้ว","nickname":"พฤกษ์","school":"พัทยา","subject":"math","level":2},{"participant_code":"5713","name":"เด็กหญิงธณิชาภัทร จันทรประไพวัลย์","nickname":null,"school":"กุญแจ","subject":"english","level":1},{"participant_code":"5713","name":"เด็กหญิงธณิชาภัทร จันทรประไพวัลย์","nickname":null,"school":"กุญแจ","subject":"math","level":1},{"participant_code":"5861","name":"เด็กหญิงสิริยากร ปัทมสิงห์","nickname":"กามิว","school":"พัทยา","subject":"english","level":2},{"participant_code":"5861","name":"เด็กหญิงสิริยากร ปัทมสิงห์","nickname":"กามิว","school":"พัทยา","subject":"math","level":2},{"participant_code":"5927","name":"เด็กหญิงอลิชา เล่าสกุล","nickname":"มะลิ","school":"พัทยา","subject":"english","level":1},{"participant_code":"5994","name":"เด็กชายชนจักร อุตสาคู","nickname":null,"school":"กุญแจ","subject":"english","level":4},{"participant_code":"5994","name":"เด็กชายชนจักร อุตสาคู","nickname":null,"school":"กุญแจ","subject":"math","level":7},{"participant_code":"6147","name":"เด็กหญิงปวริศา ชื่นชม","nickname":null,"school":"กุญแจ","subject":"english","level":4},{"participant_code":"6147","name":"เด็กหญิงปวริศา ชื่นชม","nickname":null,"school":"กุญแจ","subject":"math","level":8},{"participant_code":"6231","name":"เด็กหญิงพิชามญชุ์ ห่อมณีรัตน์","nickname":null,"school":"กุญแจ","subject":"english","level":4},{"participant_code":"6231","name":"เด็กหญิงพิชามญชุ์ ห่อมณีรัตน์","nickname":null,"school":"กุญแจ","subject":"math","level":7},{"participant_code":"6322","name":"เด็กชายทัตพล เดชเสน","nickname":"บรู๊ค","school":"พิษณุโลก1","subject":"math","level":5},{"participant_code":"6383","name":"เด็กหญิงอมรรัตน์ ปะทักขินัง","nickname":null,"school":"กุญแจ","subject":"english","level":4},{"participant_code":"6383","name":"เด็กหญิงอมรรัตน์ ปะทักขินัง","nickname":null,"school":"กุญแจ","subject":"math","level":7},{"participant_code":"6386","name":"เด็กชายวิชญภัทร ไหวใจ","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"6386","name":"เด็กชายวิชญภัทร ไหวใจ","nickname":null,"school":"กุญแจ","subject":"math","level":3},{"participant_code":"6508","name":"เด็กชายปุญญพัฒน์ รัตนบันรินทร์","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"6508","name":"เด็กชายปุญญพัฒน์ รัตนบันรินทร์","nickname":null,"school":"กุญแจ","subject":"math","level":2},{"participant_code":"6604","name":"เด็กหญิงปุญญิษา ปุ่นอุดม","nickname":"ปุญ","school":"เซนโยเซฟ","subject":"english","level":2},{"participant_code":"6604","name":"เด็กหญิงปุญญิษา ปุ่นอุดม","nickname":"ปุญ","school":"เซนโยเซฟ","subject":"math","level":2},{"participant_code":"6798","name":"เด็กหญิงสุภากาญจน์  เพียรงาน","nickname":"ออคิดส์","school":"พะเยา","subject":"math","level":8},{"participant_code":"6840","name":"เด็กหญิงวัชรวรรณ พันมหา","nickname":"ขนมผิง","school":"เซนโยเซฟ","subject":"english","level":3},{"participant_code":"6840","name":"เด็กหญิงวัชรวรรณ พันมหา","nickname":"ขนมผิง","school":"เซนโยเซฟ","subject":"math","level":5},{"participant_code":"6955","name":"เด็กหญิงปณดา ปราชญ์ตานุกูล","nickname":"ณดา","school":"เซนโยเซฟ","subject":"english","level":3},{"participant_code":"6955","name":"เด็กหญิงปณดา ปราชญ์ตานุกูล","nickname":"ณดา","school":"เซนโยเซฟ","subject":"math","level":4},{"participant_code":"6978","name":"เด็กหญิงกัญญ์วรา  สุขสถิตย์","nickname":"ข้าวทิพย์","school":"พะเยา","subject":"math","level":4},{"participant_code":"7326","name":"เด็กหญิงวิลาวัณย์ พูนพัฒนาทรัพย์","nickname":null,"school":"กุญแจ","subject":"english","level":4},{"participant_code":"7326","name":"เด็กหญิงวิลาวัณย์ พูนพัฒนาทรัพย์","nickname":null,"school":"กุญแจ","subject":"math","level":8},{"participant_code":"7453","name":"เด็กชายเดวิท วานโฮสเบค","nickname":"กล้วยหอม","school":"พัทยา","subject":"english","level":4},{"participant_code":"7453","name":"เด็กชายเดวิท วานโฮสเบค","nickname":"กล้วยหอม","school":"พัทยา","subject":"math","level":7},{"participant_code":"7655","name":"เด็กชายวริทธ์พล ฉิมพรัตน์","nickname":"มิวสิค","school":"เซนโยเซฟ","subject":"english","level":3},{"participant_code":"7655","name":"เด็กชายวริทธ์พล ฉิมพรัตน์","nickname":"มิวสิค","school":"เซนโยเซฟ","subject":"math","level":4},{"participant_code":"7682","name":"เด็กชายนิโคไล ยัทกิน","nickname":"นิค","school":"พัทยา","subject":"english","level":2},{"participant_code":"7682","name":"เด็กชายนิโคไล ยัทกิน","nickname":"นิค","school":"พัทยา","subject":"math","level":2},{"participant_code":"7762","name":"เด็กหญิงณิชากร พีระนพวัฒน์","nickname":null,"school":"กุญแจ","subject":"math","level":1},{"participant_code":"7774","name":"เด็กหญิงณัฐชา บูรณะกุล","nickname":"ธัชชา","school":"พัทยา","subject":"english","level":1},{"participant_code":"7774","name":"เด็กหญิงณัฐชา บูรณะกุล","nickname":"ธัชชา","school":"พัทยา","subject":"math","level":1},{"participant_code":"7793","name":"ด็กหญิงณิชากร พีระนพวัฒน์","nickname":null,"school":"กุญแจ","subject":"english","level":1},{"participant_code":"7915","name":"เด็กชายภัทรชนน สนรักษา","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"7915","name":"เด็กชายภัทรชนน สนรักษา","nickname":null,"school":"กุญแจ","subject":"math","level":2},{"participant_code":"7950","name":"เด็กชายสุทธวีร์ ชำนาญ","nickname":null,"school":"กุญแจ","subject":"english","level":3},{"participant_code":"7950","name":"เด็กชายสุทธวีร์ ชำนาญ","nickname":null,"school":"กุญแจ","subject":"math","level":4},{"participant_code":"7956","name":"เด็กชายณัฐกฤต ขาวสูง","nickname":"ออโต้","school":"เซนโยเซฟ","subject":"english","level":4},{"participant_code":"7956","name":"เด็กชายณัฐกฤต ขาวสูง","nickname":"ออโต้","school":"เซนโยเซฟ","subject":"math","level":6},{"participant_code":"7982","name":"เด็กหญิงภิชชญา หลิ่วพงศ์สวัสดิ์","nickname":"พีชชี่","school":"พัทยา","subject":"english","level":2},{"participant_code":"7982","name":"เด็กหญิงภิชชญา หลิ่วพงศ์สวัสดิ์","nickname":"พีชชี่","school":"พัทยา","subject":"math","level":2},{"participant_code":"8005","name":"เด็กชายพิชญะ มิคะดา","nickname":"เจเดน","school":"พัทยา","subject":"english","level":2},{"participant_code":"8064","name":"เด็กหญิงเอรียา อุตมาลา","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"8064","name":"เด็กหญิงเอรียา อุตมาลา","nickname":null,"school":"กุญแจ","subject":"math","level":3},{"participant_code":"8123","name":"เด็กหญิงพรชดา สุขสา","nickname":null,"school":"กุญแจ","subject":"english","level":4},{"participant_code":"8123","name":"เด็กหญิงพรชดา สุขสา","nickname":null,"school":"กุญแจ","subject":"math","level":7},{"participant_code":"8336","name":"เด็กชายปุญญพัฒน์ สายสะอาด","nickname":"อันดา","school":"พัทยา","subject":"english","level":1},{"participant_code":"8426","name":"เด็กหญิงพิมพ์มาดา ก้อนศรี","nickname":"ดิว","school":"พัทยา","subject":"english","level":3},{"participant_code":"8426","name":"เด็กหญิงพิมพ์มาดา ก้อนศรี","nickname":"ดิว","school":"พัทยา","subject":"math","level":5},{"participant_code":"8517","name":"เด็กชายจิรภัทร ทายา","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"8517","name":"เด็กชายจิรภัทร ทายา","nickname":null,"school":"กุญแจ","subject":"math","level":2},{"participant_code":"8653","name":"เด็กชายนิติพงษ์ มีนิสัย","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"8653","name":"เด็กชายนิติพงษ์ มีนิสัย","nickname":null,"school":"กุญแจ","subject":"math","level":3},{"participant_code":"8714","name":"เด็กหญิงลลิตา แสงเงิน","nickname":null,"school":"กุญแจ","subject":"english","level":4},{"participant_code":"8714","name":"เด็กหญิงลลิตา แสงเงิน","nickname":null,"school":"กุญแจ","subject":"math","level":8},{"participant_code":"8775","name":"เด็กชายธนภัทร เกิดศรีเสริม","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"8775","name":"เด็กชายธนภัทร เกิดศรีเสริม","nickname":null,"school":"กุญแจ","subject":"math","level":3},{"participant_code":"8831","name":"เด็กหญิงศิรินธร เกิดศรีเสริม","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"8831","name":"เด็กหญิงศิรินธร เกิดศรีเสริม","nickname":null,"school":"กุญแจ","subject":"math","level":3},{"participant_code":"8869","name":"เด็กหญิงกันยกร  เมฆะวรากุล","nickname":"จัสมิน","school":"พัทยา","subject":"english","level":1},{"participant_code":"8897","name":"เด็กชายปัณณทัต  ปัญญารัตนะ","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"8897","name":"เด็กชายปัณณทัต  ปัญญารัตนะ","nickname":null,"school":"กุญแจ","subject":"math","level":3},{"participant_code":"9043","name":"เด็กหญิงสุพัตรา ยอเเซ","nickname":"ใบข้าว","school":"พัทยา","subject":"english","level":2},{"participant_code":"9057","name":"เด็กหญิงกัญญ์วรา สุขสถิตย์","nickname":"ข้าวทิพย์","school":"พะเยา","subject":"math","level":5},{"participant_code":"9149","name":"เด็กหญิงเปมิกา ศรีเยี่ยม","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"9149","name":"เด็กหญิงเปมิกา ศรีเยี่ยม","nickname":null,"school":"กุญแจ","subject":"math","level":3},{"participant_code":"9366","name":"เด็กชายภัทระ เกียนแก้ง","nickname":"ไท","school":"พัทยา","subject":"math","level":5},{"participant_code":"9384","name":"เด็กหญิงนันท์นภัส พุดสี","nickname":null,"school":"กุญแจ","subject":"english","level":1},{"participant_code":"9384","name":"เด็กหญิงนันท์นภัส พุดสี","nickname":null,"school":"กุญแจ","subject":"math","level":1},{"participant_code":"9455","name":"เด็กชายอัยยวัฒน์  เกิดศรีเสริม","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"9455","name":"เด็กชายอัยยวัฒน์  เกิดศรีเสริม","nickname":null,"school":"กุญแจ","subject":"math","level":2},{"participant_code":"9782","name":"เด็กหญิงภัทรมน สุขปรั่ง","nickname":null,"school":"กุญแจ","subject":"english","level":2},{"participant_code":"9782","name":"เด็กหญิงภัทรมน สุขปรั่ง","nickname":null,"school":"กุญแจ","subject":"math","level":3},{"participant_code":"9857","name":"เด็กชายธัชวิญญู อังคะหิรัญ","nickname":"แสนดี","school":"พัทยา","subject":"english","level":1},{"participant_code":"9894","name":"เด็กชายกรินทร์  กุญชร","nickname":"จูเนียร์","school":"หนองไผ่","subject":"english","level":3},{"participant_code":"9894","name":"เด็กชายกรินทร์  กุญชร","nickname":"จูเนียร์","school":"หนองไผ่","subject":"math","level":5},{"participant_code":"9899","name":"เด็กชายปลื้มชีวิน เนื่องจำนงค์","nickname":null,"school":"กุญแจ","subject":"english","level":3},{"participant_code":"9899","name":"เด็กชายปลื้มชีวิน เนื่องจำนงค์","nickname":null,"school":"กุญแจ","subject":"math","level":5},{"participant_code":"9923","name":"เด็กหญิงกรองแก้ว ทองรูปสวัสดิ์","nickname":"เอริตา","school":"หนองไผ่","subject":"math","level":5}]

// ── Exact copy of exportResults.js constants & styling ──

const MATH_GRADE_LABELS = {
  1: 'Kindergarten',
  2: 'Grade 1',
  3: 'Grade 2',
  4: 'Grade 3',
  5: 'Grade 4',
  6: 'Grade 5',
  7: 'Grade 6',
  8: 'Highschool 1-3',
}

const ENG_LEVEL_LABELS = {
  1: 'English Level 1',
  2: 'English Level 2',
  3: 'English Level 3',
  4: 'English Level 4',
}

const THIN_BORDER_ALL = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
}

const TITLE_BORDER = {
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
}

const THAI_HEADERS = ['ลำดับ', 'รายชื่อ', 'สาขา', 'ชื่อเล่น', 'ข้อถูก', 'นาที', 'ข้อผิด/ปรับ', 'ข้อผิด/ปรับ', 'เวลาปรับ', 'เวลาปรับ', 'วินาที', 'วินาที', 'รางวัลที่ได้']

const CYAN_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FFFF' }, bgColor: { argb: 'FF00FFFF' } }
const YELLOW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' }, bgColor: { argb: 'FFFFFF00' } }
const GRAY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA5A5A5' }, bgColor: { argb: 'FFA5A5A5' } }

const COL_WIDTHS = [5, 50, 22, 16, 8, 7, 4, 2.5, 8.5, 3, 5.5, 5.5, 35]

function buildSubjectFile(subjectSessions, subject) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Wonderkids Championship'

  const isMath = subject === 'math'
  const levelLabels = isMath ? MATH_GRADE_LABELS : ENG_LEVEL_LABELS
  const headerMainFill = isMath ? YELLOW_FILL : CYAN_FILL
  const headerSmallFill = isMath ? GRAY_FILL : CYAN_FILL

  const ws = wb.addWorksheet('E')
  ws.columns = COL_WIDTHS.map(w => ({ width: w }))
  ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 }

  for (let c = 7; c <= 12; c++) {
    ws.getColumn(c).hidden = true
  }

  let currentRow = 1
  const levels = [...new Set(subjectSessions.map(s => s.level))].sort((a, b) => a - b)

  for (const level of levels) {
    const title = levelLabels[level] || `Level ${level}`
    const levelSessions = [...subjectSessions.filter(s => s.level === level)]
      .sort((a, b) => (a.school || '').localeCompare(b.school || '', 'th') || a.name.localeCompare(b.name, 'th'))

    ws.mergeCells(`A${currentRow}:M${currentRow}`)
    const titleCell = ws.getCell(`A${currentRow}`)
    titleCell.value = title
    titleCell.font = { bold: true, size: 28, name: 'CordiaUPC', color: { theme: 1 } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    titleCell.border = TITLE_BORDER
    ws.getRow(currentRow).height = 45
    currentRow++

    const headerRow = ws.getRow(currentRow)
    headerRow.height = 30
    ws.mergeCells(`G${currentRow}:H${currentRow}`)
    ws.mergeCells(`I${currentRow}:J${currentRow}`)

    for (let c = 1; c <= 13; c++) {
      const cell = headerRow.getCell(c)
      cell.value = THAI_HEADERS[c - 1]
      const isSmall = c >= 7 && c <= 12
      cell.font = { bold: true, size: isSmall ? 14 : 18, name: 'Angsana New', color: { theme: 1 } }
      cell.fill = isSmall ? headerSmallFill : headerMainFill
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = THIN_BORDER_ALL
    }
    currentRow++

    let rowNum = 1
    for (const s of levelSessions) {
      const row = ws.getRow(currentRow)
      row.height = 30
      const fontSize = 20

      const cellA = row.getCell(1)
      cellA.value = rowNum++
      cellA.font = { bold: true, size: fontSize, name: 'Angsana New', color: { theme: 1 } }
      cellA.alignment = { horizontal: 'center', vertical: 'middle' }
      cellA.border = THIN_BORDER_ALL

      const cellB = row.getCell(2)
      cellB.value = s.name || ''
      cellB.font = { size: fontSize, name: 'Angsana New', color: { theme: 1 } }
      cellB.alignment = { horizontal: 'left', vertical: 'middle' }
      cellB.border = THIN_BORDER_ALL

      const cellC = row.getCell(3)
      cellC.value = s.school || ''
      cellC.font = { size: fontSize, name: 'Angsana New', color: { theme: 1 } }
      cellC.alignment = { vertical: 'middle' }
      cellC.border = THIN_BORDER_ALL

      const cellD = row.getCell(4)
      cellD.value = s.nickname || ''
      cellD.font = { size: fontSize, name: 'AngsanaUPC', color: { theme: 1 } }
      cellD.alignment = { horizontal: 'center', vertical: 'middle' }
      cellD.border = THIN_BORDER_ALL

      for (let c = 5; c <= 13; c++) {
        const cell = row.getCell(c)
        cell.value = ''
        cell.font = { size: fontSize, name: 'Angsana New', color: { theme: 1 } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = THIN_BORDER_ALL
      }

      currentRow++
    }

    currentRow += 3
  }

  return wb
}

// ── Generate ──
const dir = path.resolve(import.meta.dirname, '..')
const english = sessions.filter(s => s.subject === 'english')
const math = sessions.filter(s => s.subject === 'math')

const wbEng = buildSubjectFile(english, 'english')
await wbEng.xlsx.writeFile(path.join(dir, 'Roster-English.xlsx'))
const engLevels = [...new Set(english.map(s => s.level))].sort((a, b) => a - b)
console.log(`Roster-English.xlsx — ${english.length} students, ${engLevels.length} level sections: ${engLevels.map(l => ENG_LEVEL_LABELS[l]).join(', ')}`)

const wbMath = buildSubjectFile(math, 'math')
await wbMath.xlsx.writeFile(path.join(dir, 'Roster-Math.xlsx'))
const mathLevels = [...new Set(math.map(s => s.level))].sort((a, b) => a - b)
console.log(`Roster-Math.xlsx — ${math.length} students, ${mathLevels.length} level sections: ${mathLevels.map(l => MATH_GRADE_LABELS[l]).join(', ')}`)

console.log('Done — exact exportResults.js template, no score/rank/award.')
