import { getNovelViews, getNovelTotalChapters } from '@/lib/novelStats';

export interface FallbackChapter {
  id: string;
  chapterNumber: number;
  title: string;
  content: string;
  createdAt: string;
  isVip?: boolean;
  coinPrice?: number;
}

export interface FallbackNovel {
  id: string;
  title: string;
  author: string;
  description: string;
  genres: string[];
  coverUrl: string;
  rating: number;
  views: number;
  status: 'Đang ra' | 'Hoàn thành';
  isHot: boolean;
  isFull: boolean;
  totalChapters: number;
  chapters: FallbackChapter[];
  updatedAt: string;
  isPublic: boolean;
  approvalStatus: string;
}

export const FALLBACK_NOVELS: FallbackNovel[] = [
  {
    id: 'vo-than-chua-te',
    title: 'Võ Thần Chúa Tể',
    author: 'Ám Ma Sư',
    description: 'Thiên Vũ đại lục đệ nhất Đan Hoàng Tần Trần, vì bị hồng nhan tri kỷ và huynh đệ kết nghĩa phản bội mà ôm hận ngã xuống. Ba trăm năm sau, hắn chuyển sinh trọng sinh vào một thiếu niên phế vật cùng tên tại vương triều Đại Tề. Nắm giữ đan đạo chí tôn kiếp trước cùng ký ức võ đạo thông thiên, Tần Trần quyết tâm quét sạch mọi cản trở, chấn hưng gia tộc, từng bước đạp phá thiên địa, tái lâm đỉnh phong báo huyết hải thâm thù!',
    genres: ['Huyền Huyễn', 'Tiên Hiệp', 'Trọng Sinh', 'Hệ Thống'],
    coverUrl: '/covers/vo-than-chua-te.jpg',
    rating: 4.9,
    views: 186500,
    status: 'Đang ra',
    isHot: true,
    isFull: false,
    totalChapters: 450,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Trọng sinh ba trăm năm',
        content: `Thiên Vũ đại lục, ba trăm năm trước.

Trên đỉnh Tử Thần Nhai, mây mù cuồn cuộn vần vũ. Một thân ảnh cao ngạo đứng sừng sững giữa trời đất, trường bào nhuộm đỏ máu tươi.

"Thượng Quan Hi Nhi, Phong Thiếu Vũ! Ta đối đãi với các ngươi hết lòng hết dạ, coi như chí thân ruột thịt, dốc hết tâm huyết luyện chế Cửu Chuyển Thần Đan cho các ngươi... Không ngờ tới phút cuối cùng, hai kẻ các ngươi lại liên thủ đâm một nhát kiếm xuyên tim ta!"

Tần Trần cười thảm, tiếng cười chấn động cửu tiêu, bi phẫn tột cùng. Hắn là đệ nhất Đan Hoàng của đại lục, nghiên cứu ra vô số tuyệt kỹ đan đạo và trận pháp vang danh thiên cổ, nhưng rốt cuộc lại chết dưới tay người mình yêu thương nhất và huynh đệ kết nghĩa thề sống chết.

"Tần Trần, trách thì trách ngươi quá mức chói sáng, nắm giữ bí mật thần cấm mà không chịu giao ra!" Giọng nói lãnh khốc vô tình của nữ tử áo đỏ vẫn còn văng vẳng bên tai.

Oành!

Tần Trần dứt khoát dẫn nổ đan điền, thân thể hóa thành tro bụi giữa vòm trời bão táp.

...

"Đau quá..."

Trong một gian phòng gỗ thô sơ ngập tràn mùi thảo dược, một thiếu niên đột nhiên mở bừng mắt. Hắn thở hổn hển, mồ hôi ướt đẫm trán, bàn tay nắm chặt lấy mép giường.

"Đây là đâu? Ta... chưa chết sao?"

Ký ức xa lạ như thủy triều cuồn cuộn tràn vào óc. Hắn hiện tại đang ở vương quốc Đại Tề, thuộc một góc hẻo lánh của Thiên Vũ đại lục. Thân thể này cũng mang tên Tần Trần, là con trai của Tần Nguyệt Trì – thiên kim Tần gia nhưng vì sinh con không rõ phụ thân mà bị gia tộc ruồng bỏ, giáng xuống gia phả, chịu muôn vàn nhục nhã.

Bản thân thiếu niên này trời sinh kinh mạch bế tắc, mười sáu tuổi vẫn chưa thể ngưng tụ chân khí, bị coi là phế vật nổi tiếng toàn Vương đô.

"Ba trăm năm rồi... Không ngờ đã ba trăm năm trôi qua!"

Tần Trần bước xuống giường, nhìn vào chiếc gương đồng mờ đục. Gương mặt thiếu niên thanh tú nhưng tái nhợt, ánh mắt lại lộ ra vẻ thâm thúy và uy nghiêm của bậc đế hoàng từng ngự trị đỉnh cao thiên hạ.

"Thượng Quan Hi Nhi, Phong Thiếu Vũ... Các ngươi thành lập Chấp Pháp Điện, xưng bá Thiên Vũ, được vạn người tôn sùng là Thánh Chủ sao? Hãy đợi đấy! Tần Trần ta đã trở lại, nợ máu kiếp trước, kiếp này ta bắt các ngươi phải hoàn trả gấp trăm ngàn lần!"`,
        createdAt: '2026-10-20T08:00:00Z',
      },
      {
        id: 'chuong-2',
        chapterNumber: 2,
        title: 'Chương 2: Tuyệt thế dược lý',
        content: `Tần Trần đứng trước gương, quan sát kỹ lưỡng kinh mạch của cơ thể mới này rồi lắc đầu cười khẽ:

"Kinh mạch tắc nghẽn, khí huyết hao hụt, quả thực ngay cả võ giả sơ cấp cũng không bằng. Nhưng đối với Đan Hoàng Tần Trần ta, đây căn bản chỉ là chuyện nhỏ."

Kiếp trước hắn tinh thông y đạo lẫn võ đạo, nắm giữ vô số đan phương thất truyền từ thời viễn cổ. Chỉ cần có đủ dược liệu, việc đả thông kinh mạch và rèn đúc lại căn cơ hoàn toàn nằm trong lòng bàn tay.

"Trần nhi, con tỉnh rồi sao? Tạ ơn trời đất!"

Cửa phòng bật mở, một mỹ phụ trung niên mang vẻ mặt tiều tụy nhưng đường nét vô cùng đoan trang bước vội vào. Thấy Tần Trần đứng dậy, khóe mắt bà đỏ hoe, ôm chầm lấy hắn. Đây chính là mẫu thân của hắn kiếp này – Tần Nguyệt Trì.

"Mẹ, con đã không sao rồi. Từ nay về sau, có con ở đây, tuyệt đối không ai có thể khi bắt nạt mẫu tử chúng ta được nữa!" Tần Trần nhẹ nhàng vỗ về vai bà, ánh mắt tràn đầy kiên định.

Hắn quyết định đến Tụ Bảo Các – linh dược phường lớn nhất vương đô để tìm kiếm vài vị dược liệu cần thiết cho việc luyện chế Tẩy Tủy Dịch.

Bước vào đại sảnh Tụ Bảo Các ngào ngạt hương thảo dược, Tần Trần đưa mắt nhìn quanh. Đúng lúc một gã đan đồ đang lúng túng giải thích cho khách hàng về một gốc Xích Diễm Thảo, Tần Trần cất giọng điềm tĩnh:

"Xích Diễm Thảo sinh trưởng nơi nham thạch, nếu đem phối hợp cùng Băng Tâm Hoa mà không dùng Uẩn Linh Thủy trung hòa thì chẳng những triệt tiêu dược tính, mà còn biến thành kịch độc phế bỏ đan điền võ giả!"

Lời vừa dứt, toàn bộ đại sảnh đột nhiên im bặt!`,
        createdAt: '2026-10-21T09:00:00Z',
      },
      {
        id: 'chuong-3',
        chapterNumber: 3,
        title: 'Chương 3: Chấn kinh Tụ Bảo Các',
        content: `Tất cả ánh mắt trong sảnh lập tức đổ dồn về phía thiếu niên áo vải vừa lên tiếng.

"Khốn kiếp! Ngươi là ai mà dám ăn nói hàm hồ ở Tụ Bảo Các của ta?" Gã đan đồ thẹn quá hóa giận quát lớn.

"Hỗn xược, lui ra!"

Từ trên tầng hai, một giọng nói trầm hùng uy nghiêm vang lên. Một lão giả mặc trường bào luyện dược sư tam phẩm vội vã bước xuống, trên mặt tràn đầy kinh ngạc và kích động. Đây chính là Triệu Linh Chi – các chủ Tụ Bảo Các, một trong những đan sư có danh vọng cao nhất Đại Tề quốc.

Vấn đề phối hợp Xích Diễm Thảo và Băng Tâm Hoa đã khiến lão trăn trở suốt ba năm qua mà chưa tìm ra lời giải. Vừa rồi nghe thiếu niên nói đến ba chữ 'Uẩn Linh Thủy', trong đầu lão như có một tia sét đánh qua khai thông mọi bế tắc!

"Dám hỏi tiểu hữu, phương pháp dùng Uẩn Linh Thủy trung hòa này, ngươi học được từ vị cao nhân nào?" Lão giả cung kính cúi người hỏi, khiến toàn thể hộ vệ và khách mua hàng tròn xoe mắt kinh hãi.

Tần Trần mỉm cười nhạt: "Không cần hỏi xuất xứ. Ta đến đây là muốn đổi lấy ba gốc Tử Vân Thảo và một viên Thú Đan nhị giai. Lão các chủ thấy dược lý vừa rồi có đủ giá trị hay không?"

"Đủ! Quá đủ! Người đâu, mau mang dược liệu thượng phẩm nhất lên cho tiểu tiên sinh!" Triệu Linh Chi không chút do dự hạ lệnh.`,
        createdAt: '2026-10-22T10:00:00Z',
      },
    ],
  },
  {
    id: 'nu-phu-phan-cong-he-thong-nu-than-gioi-giai-tri-4w51',
    title: 'Nữ Phụ Phản Công: Hệ Thống Nữ Thần Giới Giải Trí',
    author: 'Lam Tuyết',
    description: 'Bị bạn trai "cắm sừng" và đồng nghiệp hãm hại, cô gái yếu đuối năm xưa nay đã có "Hệ Thống Đổi Đời" trong tay! Trọng sinh không phải là kết thúc, mà là khởi đầu cho hành trình báo thù và vươn tới đỉnh cao giới giải trí. Từng bước giẫm đạp tra nam tiện nữ, đoạt lấy ảnh hậu kim quang tỏa sáng!',
    genres: ['Hệ Thống', 'Đô Thị', 'Nữ Cường', 'Trọng Sinh'],
    coverUrl: '/covers/nu-phu-phan-cong.jpg',
    rating: 4.9,
    views: 142000,
    status: 'Đang ra',
    isHot: true,
    isFull: false,
    totalChapters: 380,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Trọng sinh ngày bị phản bội',
        content: `Ánh đèn flash chói lóa cùng tiếng xì xào bàn tán của đám phóng viên như những chiếc kim nhọn đâm thẳng vào màng nhĩ Tô Mạt.

"Tô Mạt, cô giải thích sao về việc bị bắt gặp say xỉn trong phòng của đạo diễn Vương?"
"Có phải cô cố tình dùng quy tắc ngầm để cướp vai diễn của em họ mình không?"

Tô Mạt mở bừng mắt. Khung cảnh trước mắt quá đỗi quen thuộc... Đây chính là buổi họp báo ác mộng ba năm trước! Ngày mà cô bị bạn trai Lục Cảnh Thành và cô em họ Tô Nhã gài bẫy, tước đoạt toàn bộ danh dự, bị đuổi khỏi giới giải trí rồi rơi vào trầm cảm mà tự sát.

[Đinh! Phát hiện oán khí mãnh liệt của ký chủ. Hệ Thống Nữ Thần Giới Giải Trí chính thức kích hoạt!]
[Phần thưởng tân thủ: Nhan sắc tăng cấp SSS + Kỹ năng diễn xuất Thần Cấp!]

Khóe môi Tô Mạt khẽ nhếch lên một nụ cười lạnh lùng quyến rũ. Kiếp này, ai là thợ săn, ai là con mồi, hãy chờ xem!`,
        createdAt: '2026-10-20T08:00:00Z',
      },
      {
        id: 'chuong-2',
        chapterNumber: 2,
        title: 'Chương 2: Cú tát nghẹn ngào',
        content: `Đối diện với hàng chục ống kính máy quay đang chĩa vào mình, Tô Mạt không hề hoảng loạn rơi nước mắt như kiếp trước.

Cô bình thản cầm lấy micro, ngẩng cao đầu. Khí chất cao quý, ánh mắt sắc sảo như lưỡi kiếm khiến cả hội trường trong chớp mắt bỗng chốc im bặt.

"Các vị phóng viên, muốn biết sự thật? Tại sao không xem đoạn ghi âm khách sạn tối qua do chính trợ lý của Lục Cảnh Thành gửi cho tôi?"

Tô Mạt giơ chiếc điện thoại lên, mở loa ngoài. Tiếng bàn mưu tính kế hèn hạ giữa Lục Cảnh Thành và Tô Nhã vang vọng khắp sảnh lớn. Sắc mặt hai kẻ đang ngồi ở hàng ghế VIP lập tức trắng bệch như xác chết!`,
        createdAt: '2026-10-21T08:00:00Z',
      },
    ],
  },
  {
    id: 'tong-tai-co-chap-vo-cu-lai-yeu-lan-nua-65wu',
    title: 'Tổng Tài Cố Chấp: Vợ Cũ, Lại Yêu Lần Nữa',
    author: 'Cố Niệm',
    description: 'Ba năm hôn nhân đổi lại một tờ giấy ly hôn lạnh lùng cùng sự ruồng bỏ. Ngày cô dứt áo ra đi, người đàn ông quyền lực nhất thành phố coi đó chỉ là trò giận dỗi trẻ con. Thế nhưng khi cô trở lại với thân phận nhà thiết kế danh giá hàng đầu thế giới, vị tổng tài kiêu ngạo ấy lại phát điên quỳ gối dưới mưa cầu xin cô quay về.',
    genres: ['Ngôn Tình', 'Đô Thị', 'Hào Môn', 'Ngược Sủng'],
    coverUrl: '/covers/tong-tai-co-chap.jpg',
    rating: 4.8,
    views: 93400,
    status: 'Hoàn thành',
    isHot: true,
    isFull: true,
    totalChapters: 210,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Đơn ly hôn',
        content: `Đêm mưa tầm tã bên ngoài biệt thự họ Phó.

Thẩm An Nhiên đặt tờ đơn ly hôn đã ký sẵn lên bàn trà bằng đá cẩm thạch. Trên ngón áp út của cô, chiếc nhẫn cưới bạc đơn sơ đã được tháo xuống.

Phó Kính Thần cởi áo khoác vest, ánh mắt lạnh lùng liếc nhìn tờ giấy: "Lại giở trò gì nữa đây? Thẩm An Nhiên, lòng kiên nhẫn của tôi có hạn."

"Tôi không đùa, Phó thiếu gia. Chúng ta kết thúc tại đây." An Nhiên mỉm cười, một nụ cười thanh thản mà ba năm qua Phó Kính Thần chưa từng nhìn thấy ở cô.`,
        createdAt: '2026-10-20T08:00:00Z',
      },
      {
        id: 'chuong-2',
        chapterNumber: 2,
        title: 'Chương 2: Tái ngộ đỉnh cao',
        content: `Năm năm sau.

Sân bay quốc tế thành phố S, một bóng hồng thanh mảnh trong bộ vest trắng bước ra, theo sau là trợ lý và hàng dài vệ sĩ áo đen.

Nhà thiết kế hàng đầu Paris kiêm nữ chủ tịch tập đoàn thời trang Celia – Thẩm An Nhiên chính thức trở về. Mà người đứng chờ ở cửa VIP với ánh mắt đỏ ngầu, run rẩy không dám bước tới, lại chính là vị tổng tài ngạo mạn năm xưa – Phó Kính Thần.`,
        createdAt: '2026-10-21T08:00:00Z',
      },
    ],
  },
  {
    id: 'thi-the-cua-ta-buong-tha-phong-tung-khong-kiem-che-duoc',
    title: 'Thi Thể Của Ta Buông Thả Phóng Túng Không Kiềm Chế Được',
    author: 'Cửu U Đạo Nhân',
    description: 'Chết đi không phải là hết! Linh hồn của ta bị giam giữ trôi dạt giữa hư không, trơ mắt nhìn thi thể của chính mình dưới trăng máu đột nhiên đứng dậy... tu luyện ma công, đại náo âm dương!',
    genres: ['Kinh Dị', 'Huyền Huyễn', 'Hài Hước', 'Trọng Sinh'],
    coverUrl: '/covers/cover-thi-the.jpg',
    rating: 4.9,
    views: 128000,
    status: 'Đang ra',
    isHot: true,
    isFull: false,
    totalChapters: 310,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Dưới trăng máu, thi thể thức tỉnh',
        content: `Trăng máu treo lơ lửng trên bãi tha ma hoang vu. Gió rít từng cơn lạnh thấu xương tủy.

Linh hồn ta lơ lửng giữa không trung, bất lực nhìn xuống cái xác đang nằm thẳng đơ trong cỗ quan tài gỗ mục.

"Ủa khoan... Sao ngón tay của cái xác ta lại vừa giật một cái?"

Chưa kịp hiểu chuyện gì, nắp quan tài nổ tung thành trăm mảnh. Thi thể của ta mở trừng hai mắt đỏ rực như chu sa, bật dậy bẻ khớp kêu răng rắc!`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'yeu-than-giang-the',
    title: 'Yêu Thần Giáng Thế',
    author: 'Bát Hoang Cư Sĩ',
    description: 'Yêu Thần thức tỉnh xé toạc thương khung, chưởng khống thái cổ hồng hoang dị thú, đạp phá chư thiên thần phật, đúc nên vạn cổ bất hủ chân thân.',
    genres: ['Huyền Huyễn', 'Tiên Hiệp', 'Dị Giới'],
    coverUrl: '/covers/cover-yeu-than.jpg',
    rating: 4.9,
    views: 165000,
    status: 'Đang ra',
    isHot: true,
    isFull: false,
    totalChapters: 520,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Thái cổ Yêu Huyết thức tỉnh',
        content: `Mười vạn năm trước, Yêu Thần tung hoành vạn giới, Thần Ma cúi đầu.

Hôm nay, trong huyết mạch của một thiếu niên nô bộc tầm thường ở Man Hoang đại lục, giọt Yêu Huyết phong ấn từ viễn cổ đột nhiên bốc cháy hừng hực! Khí tức hồng hoang quét ngang ngàn dặm, thiên địa biến sắc.`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'muc-than-ky',
    title: 'Mục Thần Ký',
    author: 'Trạch Trư',
    description: 'Đại Khư tàn lão thôn xuất thế, mục dưỡng thần ma thiên hạ. Cậu bé mù, người thọt, bà mù nuôi lớn một thiếu niên không sợ trời không sợ đất, bước ra mở ra thời đại huy hoàng.',
    genres: ['Tiên Hiệp', 'Huyền Huyễn', 'Kỳ Huyễn'],
    coverUrl: '/covers/cover-muc-than.jpg',
    rating: 5.0,
    views: 198000,
    status: 'Hoàn thành',
    isHot: true,
    isFull: true,
    totalChapters: 1820,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Bên bờ sông Dũng Giang',
        content: `Trời tối rồi, đừng ra ngoài.

Lời dặn dò ngàn đời của tộc nhân Đại Khư vang vọng khắp sơn dã. Bên bờ sông Dũng Giang cuồn cuộn chảy xiết, một đứa bé sơ sinh nằm gọn trong chiếc chậu gỗ trôi dạt vào bờ cát dưới sự che chở của một con hồ ly trắng...`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'nhat-niem-vinh-hang',
    title: 'Nhất Niệm Vĩnh Hằng',
    author: 'Nhĩ Căn',
    description: 'Một niệm thành biển cả, một niệm hóa nương dâu. Nhất niệm trảm ngàn ma, nhất niệm tru vạn tiên. Duy ta niệm... Vĩnh hằng!',
    genres: ['Tiên Hiệp', 'Hài Hước', 'Tu Chân'],
    coverUrl: '/covers/cover-vinh-hang.jpg',
    rating: 4.9,
    views: 174000,
    status: 'Hoàn thành',
    isHot: true,
    isFull: true,
    totalChapters: 1314,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Bạch Tiểu Thuần sợ chết',
        content: `Mao Sơn hạ, thôn trang nhỏ.

Bạch Tiểu Thuần gầy gò mặc áo vải thô, run rẩy châm nén nhang thứ mười ba trên đỉnh núi. Sấm sét rền vang chân trời, hắn ôm đầu la lớn:

"Tiên nhân gia gia, người mau tới đi! Con sợ sét đánh chết mất thôi!"`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'nghich-menh-thanh-ma',
    title: 'Nghịch Mệnh Thánh Ma',
    author: 'Bất Bại Chiến Thần',
    description: 'Thiên đạo bất công, coi vạn vật như cỏ rác. Vậy thì ta nhập ma đạo, nghịch thiên cải mệnh, đồ sát thánh nhân!',
    genres: ['Tiên Hiệp', 'Mạt Thế', 'Hắc Ám'],
    coverUrl: '/covers/cover-nghich-menh.jpg',
    rating: 4.8,
    views: 115000,
    status: 'Đang ra',
    isHot: false,
    isFull: false,
    totalChapters: 290,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Huyết tẩy tông môn',
        content: `Huyết quang ngập trời nhuộm đỏ chín tầng mây.

Cầm thanh kiếm gãy trong tay, Tiêu Viêm nhìn những kẻ tự xưng là danh môn chính phái đang vây quanh mình, khóe miệng nhếch lên nụ cười tàn nhẫn: "Các ngươi muốn ta chết? Ta sẽ kéo cả tông môn các ngươi cùng chôn thây!"`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'tu-xuan',
    title: 'Tự Xuân',
    author: 'Yến Quy Lai',
    description: 'Cung đình thâm sâu như biển máu, từng bước kinh tâm đoạt lấy phượng vị. Nữ nhi danh môn tái xuất, xoay chuyển càn khôn triều đình.',
    genres: ['Cung Đấu', 'Cổ Đại', 'Trùng Sinh', 'Ngôn Tình'],
    coverUrl: '/covers/cover-tu-xuan.jpg',
    rating: 4.9,
    views: 89000,
    status: 'Hoàn thành',
    isHot: false,
    isFull: true,
    totalChapters: 180,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Mưa thu trong cung cấm',
        content: `Mưa thu rơi lộp độp trên mái ngói lưu ly của Dực Khôn Cung.

Khương Nhược Huyên ngồi trước bàn trang điểm, nâng chén trà hoa cúc thơm ngát. Nàng biết, ngày mai thánh chỉ sắc phong hoàng hậu sẽ được ban xuống, nhưng vị trí đó là do nàng dẫm lên hàng ngàn cạm bẫy mà đoạt lấy.`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'trong-sinh-ta-khong-lam-oan-gia',
    title: 'Trọng Sinh Ta Không Làm Oan Gia',
    author: 'Nguyệt Hạ Khán Thư',
    description: 'Kiếp trước gả nhầm người, cả nhà chịu tru di tam tộc. Kiếp này quay về tuổi mười lăm, nàng quyết từ hôn, bảo vệ gia môn, tìm lại chân ái đời mình.',
    genres: ['Trọng Sinh', 'Cổ Đại', 'Gia Đấu', 'Ngôn Tình'],
    coverUrl: '/covers/cover-trong-sinh-oan-gia.jpg',
    rating: 4.8,
    views: 96000,
    status: 'Hoàn thành',
    isHot: false,
    isFull: true,
    totalChapters: 220,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Tỉnh lại giữa hoa lê',
        content: `Hương hoa lê thoang thoảng trong gió sớm mùa xuân.

Mộc Thanh Dao sờ lên cần cổ mịn màng không chút tỳ vết của mình, nước mắt tuôn rơi. Nàng đã thực sự quay về năm mười lăm tuổi, trước khi bản thân bước lên kiệu hoa gả cho gã lang quân trăng hoa táng tận lương tâm kia.`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'dai-ca-nhat-quyet-cuoi-ky-nu-ta-thanh-toan-cho-han-ca-doi-phai-hoi-han',
    title: 'Đại Ca Nhất Quyết Cưới Kỹ Nữ, Ta Thành Toàn Cho Hắn Cả Đời Phải Hối Hận',
    author: 'Tô Tiếu Tiếu',
    description: 'Đại ca vì một ả phong trần mà đòi đuổi mẹ ruột và muội muội ra khỏi phủ. Ta không khóc lóc, chỉ lặng lẽ mang toàn bộ hồi môn và gia sản rời đi. Để xem không có bạc của ta, đôi uyên ương các ngươi sống được mấy ngày!',
    genres: ['Gia Đấu', 'Cổ Đại', 'Nữ Cường', 'Sảng Văn'],
    coverUrl: '/covers/cover-dai-ca-cuoi-ky-nu.jpg',
    rating: 4.9,
    views: 112000,
    status: 'Hoàn thành',
    isHot: true,
    isFull: true,
    totalChapters: 85,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Đoạn tuyệt gia môn',
        content: `Trước sảnh đường Tạ phủ, đại ca Tạ Hoài An quỳ gối, dập đầu đến chảy máu:

"Mẫu thân, muội muội! Con và Liễu cô nương là chân ái! Nếu gia đình không cho con cưới nàng làm chính thê, con thà từ bỏ công danh!"

Ả kỹ nữ Liễu Như Yên nép sau lưng hắn, khóe môi thoáng hiện nụ cười đắc thắng.

Ta nhẹ nhàng đặt chén trà xuống, ra hiệu cho chưởng quầy mang khế ước gia sản ra: "Được, vậy hôm nay chia gia tài. Toàn bộ điền trang, ngân hiệu đứng tên ta và mẫu thân, một xu huynh cũng đừng hòng đụng tới."`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'luan-hoi-chi-chu-tuoc-doat-van-gioi',
    title: 'Luân Hồi Chi Chủ: Tước Đoạt Vạn Giới',
    author: 'Cửu Trọng Thiên',
    description: 'Mở ra Luân Hồi Chi Nhãn, tước đoạt khí vận chư thiên vạn giới. Bắt đầu từ một tiểu tốt vô danh, cướp đoạt công pháp, bảo vật, xưng bá thần giới.',
    genres: ['Huyền Huyễn', 'Võng Du', 'Hệ Thống'],
    coverUrl: '/covers/cover-luan-hoi.jpg',
    rating: 4.8,
    views: 104000,
    status: 'Đang ra',
    isHot: false,
    isFull: false,
    totalChapters: 360,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Thần đồng Luân Hồi',
        content: `[Đinh! Kích hoạt Luân Hồi Chi Nhãn thành công!]
[Phát hiện khí vận tử kim của Thiên Mệnh Chi Tử trong phạm vi 10 mét... Bắt đầu tước đoạt!]

Lâm Phong mở mắt ra, nhìn thấy vầng hào quang chói mắt trên đỉnh đầu kẻ thù truyền kiếp đang từ từ chuyển dời sang cơ thể mình. Một kỷ nguyên mới đã bắt đầu!`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'vao-ngay-thu-100-ly-hon-toi-chet-tren-ban-mo-cua-nguoi-chong-yeu-dau',
    title: 'Vào Ngày Thứ 100 Ly Hôn, Tôi Chết Trên Bàn Mổ Của Người Chồng Yêu Dấu',
    author: 'Bạch Lộ',
    description: 'Anh là bác sĩ ngoại khoa xuất sắc nhất, nhưng lưỡi dao của anh lại không thể cứu được trái tim đã nguội lạnh của cô. Ngày cô trút hơi thở cuối cùng, anh mới điên cuồng nhận ra ai mới là mạng sống của đời mình.',
    genres: ['Ngôn Tình', 'Ngược Tâm', 'Đô Thị', 'Chữa Lành'],
    coverUrl: '/covers/cover-100-ngay-ly-hon.jpg',
    rating: 4.9,
    views: 125000,
    status: 'Hoàn thành',
    isHot: true,
    isFull: true,
    totalChapters: 120,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Nhịp tim ngừng đập',
        content: `Tít... Tít... Títttttt——

Đường điện tâm đồ trên màn hình máy đo phẳng lì thành một đường thẳng tắp.

Đôi bàn tay cầm dao mổ của viện trưởng Kỷ Trạch Hạo đột nhiên run rẩy dữ dội. Máu tươi nhuộm đỏ găng tay cao su. Người phụ nữ nằm dưới ánh đèn phẫu thuật sắc lạnh chính là người vợ mà anh đã ký đơn ly hôn đúng một trăm ngày trước.`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'dem-trang-muong-ba-li',
    title: 'Đêm Trắng Mường Ba Lí',
    author: 'Trần Vũ Hoàng',
    description: 'Một vụ án bí ẩn giữa núi rừng Tây Bắc hiểm trở. Đằng sau những tập tục cổ xưa là âm mưu kinh hoàng và câu chuyện tình yêu đầy bi tráng.',
    genres: ['Kinh Dị', 'Trinh Thám', 'Đô Thị'],
    coverUrl: '/covers/dem-trang-muong-ba-li.jpg',
    rating: 4.8,
    views: 87000,
    status: 'Hoàn thành',
    isHot: false,
    isFull: true,
    totalChapters: 65,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Tiếng sáo trong đêm sương mù',
        content: `Đêm Mường Ba Lí lạnh căm căm.

Sương mù giăng kín đỉnh đèo như dải lụa trắng ma mị. Từ sâu trong thung lũng hoang phế, vẳng lại tiếng khèn bè thê lương ai oán khiến đàn chim đêm bay tán loạn...`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
];

export function getFallbackNovel(slug: string): FallbackNovel | null {
  if (!slug) return null;
  const normalized = slug.trim().toLowerCase();
  
  // Exact match by ID
  const direct = FALLBACK_NOVELS.find(n => n.id === normalized);
  if (direct) return direct;

  // Partial match by slug prefix
  const partial = FALLBACK_NOVELS.find(n => n.id.startsWith(normalized) || normalized.startsWith(n.id));
  if (partial) return partial;

  return null;
}

export function getFallbackChapter(slug: string, chapterId: string): { novel: FallbackNovel; chapter: FallbackChapter } | null {
  const novel = getFallbackNovel(slug);
  if (!novel) return null;

  // Find exact chapter id
  let chap = novel.chapters.find(c => c.id === chapterId);
  if (!chap) {
    // If chapterId is like 'chuong-1' or '1' or 'chapter-1'
    const num = parseInt(chapterId.replace(/\D/g, ''), 10);
    if (!isNaN(num)) {
      chap = novel.chapters.find(c => c.chapterNumber === num);
    }
  }

  // If still not found, fallback to first chapter
  if (!chap && novel.chapters.length > 0) {
    chap = novel.chapters[0];
  }

  if (!chap) return null;
  return { novel, chapter: chap };
}
